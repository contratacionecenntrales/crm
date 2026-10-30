import 'server-only';
import { cache } from 'react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { AJUSTES_VACIOS, type Ajustes } from './tipos';

export const ajustesDe = cache(async (subId: string): Promise<Ajustes> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('conv_ajustes').select('*').eq('subcuenta_id', subId).maybeSingle();
  return { ...AJUSTES_VACIOS, ...((data ?? {}) as Partial<Ajustes>) };
});

export const secretosPuestos = cache(async (subId: string) => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('conv_estado_secretos', { p_subcuenta: subId });
  return (data ?? { twilio_token: false, mailgun_clave: false, mailgun_firma: false, smtp_clave: false }) as
    { twilio_token: boolean; mailgun_clave: boolean; mailgun_firma: boolean; smtp_clave: boolean };
});

// Canales con los que se puede escribir ahora mismo.
export function canalesDisponibles(a: Ajustes) {
  return {
    sms: Boolean(a.twilio_sid && a.twilio_numero_sms),
    whatsapp: Boolean(a.twilio_sid && (a.twilio_numero_wa || a.twilio_numero_sms)),
    email: Boolean(a.correo_proveedor && a.correo_remitente),
  };
}
