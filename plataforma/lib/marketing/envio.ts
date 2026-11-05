import 'server-only';
import { adminObligatorio, enviarGuardado } from '@/lib/conversaciones/envio';
import { rellenarVariables } from '@/lib/automatizacion/tipos';
import { siteUrl } from '@/lib/env';

// Envía por tandas las campañas en curso (ver script 26).
interface Envio { id: string; campana_id: string; subcuenta_id: string; contacto_id: string; token: string }
interface Campana { id: string; canal: 'email' | 'sms' | 'whatsapp'; asunto: string; cuerpo: string; empresa: string }

export async function procesarCampanas(limite = 150, hasta = Date.now() + 40_000) {
  const admin = adminObligatorio();
  const resumen = { tomados: 0, enviados: 0, fallidos: 0 };
  const { data, error } = await admin.rpc('mkt_tomar', { p_limite: limite });
  if (error) throw new Error(error.message);
  const campanas = new Map<string, Campana>();
  for (const e of (data ?? []) as Envio[]) {
    if (Date.now() > hasta) {
      await admin.from('mkt_envios').update({ estado: 'pendiente', tomado_en: null }).eq('id', e.id).eq('estado', 'procesando');
      continue;
    }
    resumen.tomados++;
    try {
      let c = campanas.get(e.campana_id);
      if (!c) {
        const { data: x } = await admin.from('mkt_campanas').select('id, canal, asunto, cuerpo, estado, subcuenta:subcuentas(nombre)').eq('id', e.campana_id).single();
        if (!x || x.estado !== 'enviando') { await admin.from('mkt_envios').update({ estado: 'omitido', error: 'Campaña detenida.' }).eq('id', e.id); continue; }
        c = { id: x.id, canal: x.canal, asunto: x.asunto, cuerpo: x.cuerpo, empresa: (x.subcuenta as unknown as { nombre: string })?.nombre ?? '' };
        campanas.set(e.campana_id, c);
      }
      const fallo = await enviarUno(e, c);
      await admin.from('mkt_envios').update(fallo
        ? { estado: 'fallido', error: fallo.slice(0, 1000) }
        : { estado: 'enviado', error: '', enviado_en: new Date().toISOString() }).eq('id', e.id);
      if (fallo) resumen.fallidos++; else resumen.enviados++;
    } catch (err) {
      resumen.fallidos++;
      await admin.from('mkt_envios').update({ estado: 'fallido', error: ((err as Error).message || 'Error').slice(0, 1000) }).eq('id', e.id);
    }
  }
  return resumen;
}

async function enviarUno(e: Envio, c: Campana): Promise<string | null> {
  const admin = adminObligatorio();
  const { data: k } = await admin.from('crm_contactos').select('nombre, apellidos, email, telefono, dnd, dnd_canales').eq('id', e.contacto_id).maybeSingle();
  if (!k) return 'El contacto ya no existe.';
  if (k.dnd || (k.dnd_canales as string[]).includes(c.canal)) return 'El contacto se dio de baja o tiene «No molestar».';
  const valores: Record<string, string> = {
    'contacto.nombre': k.nombre, 'contacto.apellidos': k.apellidos,
    'contacto.nombre_completo': `${k.nombre} ${k.apellidos}`.trim() || (k.email ?? '') || k.telefono,
    'contacto.email': k.email ?? '', 'contacto.telefono': k.telefono, 'empresa.nombre': c.empresa,
  };
  let cuerpo = rellenarVariables(c.cuerpo, valores).trim();
  if (!cuerpo) return 'El mensaje quedó vacío.';
  cuerpo += c.canal === 'email'
    ? `\n\n—\nSi no quieres recibir más correos de ${c.empresa}, date de baja aquí: ${siteUrl()}/baja/${e.token}`
    : '\nResponde BAJA para no recibir más mensajes.';
  let { data: conv } = await admin.from('conv_conversaciones').select('id').eq('subcuenta_id', e.subcuenta_id).eq('contacto_id', e.contacto_id).maybeSingle();
  if (!conv) {
    const ins = await admin.from('conv_conversaciones').upsert({ subcuenta_id: e.subcuenta_id, contacto_id: e.contacto_id }, { onConflict: 'subcuenta_id,contacto_id' }).select('id').single();
    if (ins.error) return ins.error.message;
    conv = ins.data;
  }
  const m = await admin.from('conv_mensajes').insert({
    subcuenta_id: e.subcuenta_id, conversacion_id: conv!.id, direccion: 'saliente', canal: c.canal,
    asunto: c.canal === 'email' ? rellenarVariables(c.asunto, valores).slice(0, 300) : '', cuerpo: cuerpo.slice(0, 20000), estado: 'pendiente',
  }).select('id').single();
  if (m.error) return m.error.message;
  await admin.from('mkt_envios').update({ mensaje_id: m.data.id }).eq('id', e.id);
  return enviarGuardado(e.subcuenta_id, m.data.id as string);
}
