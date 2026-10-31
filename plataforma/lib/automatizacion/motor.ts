import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminObligatorio, enviarGuardado } from '@/lib/conversaciones/envio';
import { diaEn, fechaLarga, horaEn } from '@/lib/calendario/tiempo';
import { esperaEnMinutos, esquemaPaso, rellenarVariables, urlPublica, type Paso } from './tipos';
import { postJsonSeguro } from '@/lib/red/seguro';

interface Ejecucion {
  id: string; subcuenta_id: string; flujo_id: string; contacto_id: string; paso: number; pasos: unknown[]; datos: Record<string, unknown>;
}
interface Contacto { id: string; nombre: string; apellidos: string; email: string | null; telefono: string; etiquetas: string[]; propietario_id: string | null }

const MAX_PASOS_POR_VUELTA = 50;

// Ejecuta las ejecuciones que tocan (o solo una, para «Probar»).
export async function procesarAutomatizaciones(limite = 50, solo?: string) {
  const admin = adminObligatorio();
  const { data, error } = await admin.rpc('aut_tomar', { p_limite: limite, p_solo: solo ?? null });
  if (error) throw new Error(error.message);
  const resumen = { tomadas: 0, pasos: 0, completadas: 0, errores: 0, aplazadas: 0 };
  const lista = (data ?? []) as Ejecucion[];
  // La función del servidor tiene un tiempo máximo: a los 40 s se devuelven a
  // la cola las ejecuciones que no se han empezado (siguen en la próxima vuelta).
  const limiteTiempo = Date.now() + 40_000;
  for (const [n, e] of lista.entries()) {
    if (Date.now() > limiteTiempo) {
      const resto = lista.slice(n).map((x) => x.id);
      await admin.from('aut_ejecuciones').update({ estado: 'pendiente', tomado_en: null }).in('id', resto).eq('estado', 'procesando');
      resumen.aplazadas = resto.length;
      break;
    }
    resumen.tomadas++;
    const r = await ejecutar(admin, e);
    resumen.pasos += r.pasos;
    if (r.estado === 'completada') resumen.completadas++;
    if (r.estado === 'error') resumen.errores++;
  }
  return resumen;
}

async function ejecutar(admin: SupabaseClient, e: Ejecucion): Promise<{ estado: string; pasos: number }> {
  const anotar = (paso: number, tipo: string, ok: boolean, detalle: string) =>
    admin.from('aut_registro').insert({ subcuenta_id: e.subcuenta_id, ejecucion_id: e.id, paso, tipo, ok, detalle: detalle.slice(0, 2000) });
  // Solo cierra si sigue «procesando»: si alguien la sacó del flujo, no se pisa.
  const cerrar = (cambios: Record<string, unknown>) => admin.from('aut_ejecuciones').update(cambios).eq('id', e.id).eq('estado', 'procesando');

  // ¿Alguien la sacó del flujo mientras se ejecutaba?
  const parada = async () => {
    const { data } = await admin.from('aut_ejecuciones').select('estado').eq('id', e.id).single();
    return data?.estado === 'terminada';
  };

  const [{ data: k }, { data: sub }] = await Promise.all([
    admin.from('crm_contactos').select('id, nombre, apellidos, email, telefono, etiquetas, propietario_id').eq('id', e.contacto_id).maybeSingle(),
    admin.from('subcuentas').select('nombre, zona_horaria').eq('id', e.subcuenta_id).single(),
  ]);
  if (!k) {
    await cerrar({ estado: 'terminada', motivo: 'El contacto ya no existe.', terminado: new Date().toISOString() });
    return { estado: 'terminada', pasos: 0 };
  }
  let contacto = k as Contacto;
  const valores = (): Record<string, string> => {
    const d = e.datos;
    const zona = (d.zona as string) || (sub?.zona_horaria as string) || 'Europe/Madrid';
    const inicio = typeof d.inicio === 'string' ? new Date(d.inicio) : null;
    return {
      'contacto.nombre': contacto.nombre, 'contacto.apellidos': contacto.apellidos,
      'contacto.nombre_completo': `${contacto.nombre} ${contacto.apellidos}`.trim() || contacto.email || contacto.telefono,
      'contacto.email': contacto.email ?? '', 'contacto.telefono': contacto.telefono, 'empresa.nombre': (sub?.nombre as string) ?? '',
      'cita.fecha': inicio ? fechaLarga(diaEn(inicio, zona)).replace(/ de \d{4}$/, '') : '', 'cita.hora': inicio ? horaEn(inicio, zona) : '',
      'mensaje.texto': String(d.texto ?? ''), 'factura.numero': String(d.numero ?? ''),
      'factura.total': d.total != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: String(d.moneda ?? 'EUR') }).format(Number(d.total)) : '',
      'oportunidad.nombre': String(d.nombre ?? ''),
    };
  };
  const t = (s: string) => rellenarVariables(s, valores());

  let i = e.paso;
  let hechos = 0;
  while (i < e.pasos.length && hechos < MAX_PASOS_POR_VUELTA) {
    const parsed = esquemaPaso.safeParse(e.pasos[i]);
    if (!parsed.success) {
      await anotar(i, 'desconocido', false, 'Paso no válido; se salta.');
      i++;
      continue;
    }
    const p: Paso = parsed.data;
    if (hechos > 0 && await parada()) return { estado: 'terminada', pasos: hechos };
    hechos++;
    if (p.tipo === 'esperar') {
      const hasta = new Date(Date.now() + esperaEnMinutos(p) * 60_000).toISOString();
      await anotar(i, p.tipo, true, `Esperando hasta ${hasta}`);
      await cerrar({ estado: 'esperando', paso: i + 1, siguiente_en: hasta, tomado_en: null });
      return { estado: 'esperando', pasos: hechos };
    }
    try {
      const r = await accion(admin, e, contacto, p, t);
      if (r.contacto) contacto = r.contacto;
      await anotar(i, p.tipo, r.ok, r.detalle);
      if (r.terminar) {
        await cerrar({ estado: 'terminada', paso: i + 1, motivo: r.detalle, terminado: new Date().toISOString() });
        return { estado: 'terminada', pasos: hechos };
      }
    } catch (err) {
      await anotar(i, p.tipo, false, (err as Error).message || 'Error');
    }
    i++;
    // Avance guardado tras cada paso: si el proceso se corta, al recuperarla
    // no se repiten los mensajes ya enviados.
    await admin.from('aut_ejecuciones').update({ paso: i, tomado_en: new Date().toISOString() }).eq('id', e.id).eq('estado', 'procesando');
  }
  if (i < e.pasos.length) {
    // Demasiados pasos seguidos: sigue en la próxima vuelta.
    await cerrar({ estado: 'pendiente', paso: i, tomado_en: null });
    return { estado: 'pendiente', pasos: hechos };
  }
  await cerrar({ estado: 'completada', paso: i, terminado: new Date().toISOString() });
  return { estado: 'completada', pasos: hechos };
}

type R = { ok: boolean; detalle: string; terminar?: boolean; contacto?: Contacto };

async function accion(admin: SupabaseClient, e: Ejecucion, c: Contacto, p: Paso, t: (s: string) => string): Promise<R> {
  const sub = e.subcuenta_id;
  switch (p.tipo) {
    case 'enviar_sms': case 'enviar_whatsapp': case 'enviar_email': {
      const canal = p.tipo === 'enviar_email' ? 'email' : p.tipo === 'enviar_sms' ? 'sms' : 'whatsapp';
      if (canal === 'email' ? !c.email : !c.telefono) return { ok: false, detalle: canal === 'email' ? 'El contacto no tiene correo.' : 'El contacto no tiene teléfono.' };
      let { data: conv } = await admin.from('conv_conversaciones').select('id').eq('subcuenta_id', sub).eq('contacto_id', c.id).maybeSingle();
      if (!conv) {
        const ins = await admin.from('conv_conversaciones').upsert({ subcuenta_id: sub, contacto_id: c.id }, { onConflict: 'subcuenta_id,contacto_id' }).select('id').single();
        if (ins.error) throw new Error(ins.error.message);
        conv = ins.data;
      }
      const cuerpo = t(p.texto).trim();
      if (!cuerpo) return { ok: false, detalle: 'El mensaje quedó vacío.' };
      const m = await admin.from('conv_mensajes').insert({
        subcuenta_id: sub, conversacion_id: conv!.id, direccion: 'saliente', canal,
        asunto: p.tipo === 'enviar_email' ? t(p.asunto).slice(0, 300) : '', cuerpo: cuerpo.slice(0, 20000), estado: 'pendiente',
      }).select('id').single();
      if (m.error) throw new Error(m.error.message);
      const fallo = await enviarGuardado(sub, m.data.id as string);
      return fallo ? { ok: false, detalle: fallo } : { ok: true, detalle: `${canal === 'email' ? 'Correo' : canal === 'sms' ? 'SMS' : 'WhatsApp'} enviado.` };
    }
    case 'anadir_etiqueta': case 'quitar_etiqueta': {
      const etiqueta = t(p.etiqueta).trim().slice(0, 60);
      const nuevas = p.tipo === 'anadir_etiqueta' ? [...new Set([...c.etiquetas, etiqueta])] : c.etiquetas.filter((x) => x !== etiqueta);
      const { error } = await admin.from('crm_contactos').update({ etiquetas: nuevas }).eq('id', c.id);
      if (error) throw new Error(error.message);
      return { ok: true, detalle: `${p.tipo === 'anadir_etiqueta' ? 'Añadida' : 'Quitada'} «${etiqueta}».`, contacto: { ...c, etiquetas: nuevas } };
    }
    case 'asignar_propietario': {
      if (!p.usuario_id) return { ok: false, detalle: 'No hay persona elegida.' };
      const { error } = await admin.from('crm_contactos').update({ propietario_id: p.usuario_id }).eq('id', c.id);
      if (error) throw new Error(error.message);
      return { ok: true, detalle: 'Propietario asignado.', contacto: { ...c, propietario_id: p.usuario_id } };
    }
    case 'crear_tarea': {
      const vence = new Date(Date.now() + p.dias * 86400_000).toISOString();
      const { error } = await admin.from('crm_tareas').insert({
        subcuenta_id: sub, contacto_id: c.id, titulo: t(p.titulo).slice(0, 200) || 'Tarea', descripcion: t(p.descripcion).slice(0, 5000),
        vence, asignado_id: p.asignado_id || c.propietario_id, creado_por: null,
      });
      if (error) throw new Error(error.message);
      return { ok: true, detalle: 'Tarea creada.' };
    }
    case 'crear_oportunidad': {
      const { error } = await admin.from('crm_oportunidades').insert({
        subcuenta_id: sub, embudo_id: p.embudo_id, etapa_id: p.etapa_id, contacto_id: c.id, nombre: t(p.nombre).slice(0, 160) || 'Oportunidad',
        valor: p.valor, propietario_id: c.propietario_id, fuente: 'Automatización', creado_por: null,
      });
      if (error) throw new Error(error.message);
      return { ok: true, detalle: 'Oportunidad creada.' };
    }
    case 'nota': {
      const { error } = await admin.from('crm_notas').insert({ subcuenta_id: sub, contacto_id: c.id, cuerpo: t(p.texto).slice(0, 10000), autor_id: null });
      if (error) throw new Error(error.message);
      return { ok: true, detalle: 'Nota añadida.' };
    }
    case 'notificar': {
      const destino = p.usuario_id || c.propietario_id;
      if (!destino) return { ok: false, detalle: 'El contacto no tiene propietario a quien avisar.' };
      const { data: puede } = await admin.rpc('usuario_ve_subcuenta', { p_usuario: destino, p_subcuenta: sub });
      if (!puede) return { ok: false, detalle: 'La persona elegida no tiene acceso a esta subcuenta.' };
      const { data: s } = await admin.from('subcuentas').select('agencia_id').eq('id', sub).single();
      const { error } = await admin.from('notificaciones').insert({
        usuario_id: destino, agencia_id: s?.agencia_id, subcuenta_id: sub, tipo: 'alerta', categoria: 'Automatización',
        titulo: t(p.titulo).slice(0, 200) || 'Aviso', cuerpo: t(p.texto).slice(0, 1000), enlace: `/subcuenta/${sub}/contacto/${c.id}`,
      });
      if (error) throw new Error(error.message);
      return { ok: true, detalle: 'Aviso enviado.' };
    }
    case 'condicion': {
      const cumple = p.regla === 'tiene_etiqueta' ? c.etiquetas.includes(p.etiqueta)
        : p.regla === 'no_tiene_etiqueta' ? !c.etiquetas.includes(p.etiqueta)
        : p.regla === 'tiene_email' ? Boolean(c.email) : Boolean(c.telefono);
      return cumple ? { ok: true, detalle: 'Se cumple la condición; sigue.' } : { ok: true, detalle: 'No se cumple la condición; el flujo termina.', terminar: true };
    }
    case 'webhook': {
      if (!urlPublica(p.url)) return { ok: false, detalle: 'La URL apunta a una dirección interna; no se llama.' };
      const cuerpo = { evento: e.datos.evento, flujo_id: e.flujo_id, ejecucion_id: e.id, subcuenta_id: sub, datos: e.datos,
        contacto: { id: c.id, nombre: c.nombre, apellidos: c.apellidos, email: c.email, telefono: c.telefono, etiquetas: c.etiquetas } };
      const r = await postJsonSeguro(p.url, cuerpo);
      return r.status >= 200 && r.status < 300 ? { ok: true, detalle: `Webhook respondió ${r.status}.` } : { ok: false, detalle: `El webhook respondió ${r.status}.` };
    }
    case 'esperar':
      return { ok: true, detalle: '' };
  }
}

