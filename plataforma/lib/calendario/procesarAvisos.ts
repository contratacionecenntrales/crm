import 'server-only';
import { siteUrl } from '@/lib/env';
import { adminObligatorio, enviarGuardado } from '@/lib/conversaciones/envio';
import { fechaLarga, diaEn, horaEn } from './tiempo';
import { textoAviso, type TipoAviso } from './avisos';

interface Fila { aviso_id: string; subcuenta_id: string; cita_id: string; tipo: TipoAviso; canal: 'email' | 'sms' | 'whatsapp' }

// Recoge los avisos vencidos y los envía como mensajes de Conversaciones (así
// quedan en el historial del contacto). Devuelve un resumen.
export async function procesarAvisos(limite = 50) {
  const admin = adminObligatorio();
  const { data, error } = await admin.rpc('cal_tomar_avisos', { p_limite: limite });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Fila[];
  const resumen = { tomados: filas.length, enviados: 0, fallidos: 0, omitidos: 0 };

  for (const f of filas) {
    const cerrar = async (estado: 'enviado' | 'fallido' | 'omitido', extra: Record<string, unknown> = {}) => {
      resumen[estado === 'enviado' ? 'enviados' : estado === 'fallido' ? 'fallidos' : 'omitidos']++;
      await admin.from('cal_avisos').update({ estado, ...(estado === 'enviado' ? { enviado_en: new Date().toISOString() } : {}), ...extra }).eq('id', f.aviso_id);
    };
    try {
      const { data: c } = await admin.from('cal_citas')
        .select('id, estado, inicio, ubicacion, token, contacto_id, calendario:cal_calendarios(nombre, zona_horaria, ubicacion, plantilla_confirmacion, plantilla_recordatorio), contacto:crm_contactos(nombre, apellidos, email, telefono), subcuenta:subcuentas(nombre)')
        .eq('id', f.cita_id).maybeSingle();
      if (!c || !c.contacto_id) { await cerrar('omitido', { error: 'La cita ya no tiene contacto.' }); continue; }
      const cal = c.calendario as unknown as { nombre: string; zona_horaria: string; ubicacion: string; plantilla_confirmacion: string; plantilla_recordatorio: string };
      const k = c.contacto as unknown as { nombre: string; apellidos: string; email: string | null; telefono: string };
      const sub = c.subcuenta as unknown as { nombre: string };
      // Un recordatorio de una cita ya cancelada o pasada no se envía.
      if (f.tipo !== 'cancelacion' && (c.estado === 'cancelada' || Date.parse(c.inicio as string) <= Date.now())) {
        await cerrar('omitido', { error: 'La cita está cancelada o ya pasó.' });
        continue;
      }
      if (f.canal === 'email' ? !k.email : !k.telefono) {
        await cerrar('omitido', { error: f.canal === 'email' ? 'El contacto no tiene correo.' : 'El contacto no tiene teléfono.' });
        continue;
      }
      const inicio = new Date(c.inicio as string);
      const { cuerpo, asunto } = textoAviso(f.tipo, { confirmacion: cal.plantilla_confirmacion, recordatorio: cal.plantilla_recordatorio }, {
        nombre: k.nombre || 'hola', calendario: cal.nombre, empresa: sub.nombre,
        fecha: fechaLarga(diaEn(inicio, cal.zona_horaria)).replace(/ de \d{4}$/, ''), hora: horaEn(inicio, cal.zona_horaria),
        ubicacion: (c.ubicacion as string) || cal.ubicacion, enlace: `${siteUrl()}/cita/${c.token}`,
      });

      // Conversación del contacto (se crea si no existe) y mensaje pendiente.
      let { data: conv } = await admin.from('conv_conversaciones').select('id').eq('subcuenta_id', f.subcuenta_id).eq('contacto_id', c.contacto_id).maybeSingle();
      if (!conv) {
        const ins = await admin.from('conv_conversaciones').upsert({ subcuenta_id: f.subcuenta_id, contacto_id: c.contacto_id }, { onConflict: 'subcuenta_id,contacto_id' }).select('id').single();
        if (ins.error) throw new Error(ins.error.message);
        conv = ins.data;
      }
      const m = await admin.from('conv_mensajes').insert({
        subcuenta_id: f.subcuenta_id, conversacion_id: conv!.id, direccion: 'saliente', canal: f.canal,
        asunto: f.canal === 'email' ? asunto.slice(0, 300) : '', cuerpo, estado: 'pendiente',
      }).select('id').single();
      if (m.error) throw new Error(m.error.message);
      const fallo = await enviarGuardado(f.subcuenta_id, m.data.id as string);
      await cerrar(fallo ? 'fallido' : 'enviado', { mensaje_id: m.data.id, error: fallo ?? '' });
    } catch (e) {
      await cerrar('fallido', { error: ((e as Error).message || 'Error').slice(0, 1000) });
    }
  }
  return resumen;
}
