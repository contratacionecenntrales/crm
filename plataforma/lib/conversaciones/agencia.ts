import 'server-only';
import { crearClienteServidor } from '@/lib/supabase/server';
import { AJUSTES_VACIOS, type Ajustes } from './tipos';

export interface FilaServicios {
  subcuenta_id: string; nombre: string; correo_proveedor: '' | 'mailgun' | 'smtp'; correo_remitente: string; mailgun_dominio: string;
  verificar_correos: boolean; twilio_sid: string; twilio_numero_sms: string; twilio_numero_wa: string; twilio_token: boolean; correo_clave: boolean;
}

export async function serviciosAgencia(agenciaId: string) {
  const supabase = await crearClienteServidor();
  const [a, s, r] = await Promise.all([
    supabase.from('agencia_servicios').select('*').eq('agencia_id', agenciaId).maybeSingle(),
    supabase.rpc('agencia_estado_secretos', { p_agencia: agenciaId }),
    supabase.rpc('agencia_resumen_servicios', { p_agencia: agenciaId }),
  ]);
  return {
    ajustes: { ...AJUSTES_VACIOS, ...((a.data ?? {}) as Partial<Ajustes>) } as Ajustes,
    puestos: (s.data ?? { twilio_token: false, mailgun_clave: false, mailgun_firma: false, smtp_clave: false }) as Record<'twilio_token' | 'mailgun_clave' | 'mailgun_firma' | 'smtp_clave', boolean>,
    filas: (r.data ?? []) as FilaServicios[],
  };
}
