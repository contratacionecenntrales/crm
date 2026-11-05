import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminObligatorio, enviarGuardado } from '@/lib/conversaciones/envio';
import { rellenarVariables } from '@/lib/automatizacion/tipos';
import { siteUrl } from '@/lib/env';

export type CanalResena = 'email' | 'sms' | 'whatsapp';
export const MENSAJE_RESENA = 'Hola {{contacto.nombre}}, gracias por confiar en {{empresa.nombre}}. ¿Nos dices qué tal te atendimos? Solo te llevará un momento: {{enlace}}';

// Crea la solicitud (con los permisos de `quien`: el usuario del panel o el
// servidor) y envía el mensaje con el enlace. Devuelve el error, si lo hay.
export async function pedirResena(quien: SupabaseClient, sub: string, contactoId: string, canal: CanalResena): Promise<string | null> {
  const { data: token, error } = await quien.rpc('rep_crear', { p_subcuenta: sub, p_contacto: contactoId, p_canal: canal });
  if (error) return error.message;
  const admin = adminObligatorio();
  const [{ data: k }, { data: s }, { data: a }] = await Promise.all([
    admin.from('crm_contactos').select('nombre, apellidos, email, telefono').eq('id', contactoId).single(),
    admin.from('subcuentas').select('nombre').eq('id', sub).single(),
    admin.from('rep_ajustes').select('mensaje, asunto').eq('subcuenta_id', sub).maybeSingle(),
  ]);
  const valores: Record<string, string> = {
    'contacto.nombre': k?.nombre ?? '', 'contacto.apellidos': k?.apellidos ?? '',
    'contacto.nombre_completo': `${k?.nombre ?? ''} ${k?.apellidos ?? ''}`.trim(), 'empresa.nombre': s?.nombre ?? '',
  };
  const enlace = `${siteUrl()}/resena/${token}`;
  let cuerpo = rellenarVariables((a?.mensaje as string) || MENSAJE_RESENA, valores);
  cuerpo = cuerpo.includes('{{enlace}}') ? cuerpo.replaceAll('{{enlace}}', enlace) : `${cuerpo.trim()}\n${enlace}`;
  let { data: conv } = await admin.from('conv_conversaciones').select('id').eq('subcuenta_id', sub).eq('contacto_id', contactoId).maybeSingle();
  if (!conv) {
    const ins = await admin.from('conv_conversaciones').upsert({ subcuenta_id: sub, contacto_id: contactoId }, { onConflict: 'subcuenta_id,contacto_id' }).select('id').single();
    if (ins.error) return ins.error.message;
    conv = ins.data;
  }
  const m = await admin.from('conv_mensajes').insert({
    subcuenta_id: sub, conversacion_id: conv!.id, direccion: 'saliente', canal, estado: 'pendiente', cuerpo: cuerpo.slice(0, 2000),
    asunto: canal === 'email' ? rellenarVariables((a?.asunto as string) || '¿Qué tal fue tu experiencia con {{empresa.nombre}}?', valores).slice(0, 300) : '',
  }).select('id').single();
  if (m.error) return m.error.message;
  return enviarGuardado(sub, m.data.id as string);
}
