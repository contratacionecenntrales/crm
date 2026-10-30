import Link from 'next/link';
import { headers } from 'next/headers';
import {
  BookUser, CalendarCheck2, CalendarDays, Check, Building2, Mail, MessageSquare, Network, Users,
} from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';

export const metadata = { title: 'Launchpad' };

// Cada paso se marca como hecho mirando datos reales de la subcuenta.
export default async function Launchpad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const cuenta = (t: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = supabase.from(t).select('id', { count: 'exact', head: true }).eq('subcuenta_id', id);
    if (f) q = f(q);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };
  const [equipo, contactos, calendarios, oportunidades, reservas, ajustes, secretos, primerCal, h] = await Promise.all([
    cuenta('subcuenta_miembros'),
    cuenta('crm_contactos'),
    cuenta('cal_calendarios', (q) => q.eq('activo', true)),
    cuenta('crm_oportunidades'),
    cuenta('cal_citas', (q) => q.eq('origen', 'reserva')),
    supabase.from('conv_ajustes').select('twilio_sid, twilio_numero_sms, correo_proveedor, correo_remitente').eq('subcuenta_id', id).maybeSingle(),
    supabase.rpc('conv_estado_secretos', { p_subcuenta: id }),
    supabase.from('cal_calendarios').select('slug').eq('subcuenta_id', id).eq('activo', true).order('creado').limit(1).maybeSingle(),
    headers(),
  ]);
  const a = ajustes.data;
  const s = (secretos.data ?? {}) as Record<string, boolean>;
  const base = `/subcuenta/${id}`;
  const web = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? ''}`;
  const correoListo = Boolean(a?.correo_proveedor && a?.correo_remitente && (a.correo_proveedor === 'smtp' || s.mailgun_clave));

  const pasos = [
    { icono: Building2, titulo: 'Completa el perfil de tu empresa', texto: 'Correo, teléfono y dirección: aparecen en tus avisos y páginas de reserva.',
      hecho: Boolean(subcuenta.email && subcuenta.telefono && subcuenta.direccion), href: `${base}/configuracion`, boton: 'Completar' },
    { icono: Users, titulo: 'Invita a tu equipo', texto: 'Da acceso a las personas que atenderán contactos, citas y mensajes.',
      hecho: equipo > 0, href: `${base}/configuracion/usuarios`, boton: 'Invitar' },
    { icono: BookUser, titulo: 'Importa tus contactos', texto: 'Sube un CSV o crea tus primeros contactos a mano.',
      hecho: contactos > 0, href: `${base}/contactos?importar=1`, boton: 'Importar' },
    { icono: MessageSquare, titulo: 'Conecta SMS y WhatsApp', texto: 'Conecta tu cuenta de Twilio para escribir y recibir mensajes desde Conversaciones.',
      hecho: Boolean(a?.twilio_sid && a?.twilio_numero_sms && s.twilio_token), href: `${base}/configuracion/telefonia`, boton: 'Conectar' },
    { icono: Mail, titulo: 'Configura el correo', texto: 'Mailgun o SMTP para enviar correos, confirmaciones y recordatorios.',
      hecho: correoListo, href: `${base}/configuracion/correo`, boton: 'Conectar' },
    { icono: CalendarDays, titulo: 'Crea tu calendario', texto: 'Define tu horario y comparte el enlace para que te reserven citas.',
      hecho: calendarios > 0, href: `${base}/calendarios/configuracion`, boton: 'Crear' },
    { icono: CalendarCheck2, titulo: 'Recibe tu primera reserva online', texto: 'Comparte tu página de reserva en tu web, redes o WhatsApp.',
      hecho: reservas > 0, href: primerCal.data ? `/reservar/${primerCal.data.slug}` : `${base}/calendarios/configuracion`,
      boton: primerCal.data ? 'Abrir página' : 'Crear calendario', externo: Boolean(primerCal.data),
      copiar: primerCal.data ? `${web}/reservar/${primerCal.data.slug}` : null },
    { icono: Network, titulo: 'Crea tu primera oportunidad', texto: 'Sigue cada venta en tu embudo, de nuevo lead a cerrado.',
      hecho: oportunidades > 0, href: `${base}/oportunidades?nueva=1`, boton: 'Crear' },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);

  const verde = 'inline-flex h-12 min-w-[150px] items-center justify-center rounded px-5 text-[15px] font-semibold text-white shadow-xs bg-[#16803c] hover:bg-[#126a32]';
  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 font-sans sm:px-6">
      <h1 className="mb-6 text-center text-[28px] font-medium leading-9 text-[#101828] dark:text-texto">Emprendamos juntos el camino del éxito</h1>
      <p className="mb-4 text-center text-sm text-tenue">{hechos} de {pasos.length} pasos completados ({pct} %)</p>
      <ol className="divide-y divide-borde overflow-hidden rounded border border-borde bg-superficie">
        {pasos.map((p) => {
          const Icono = p.icono;
          const soloAdmin = !soyAdmin && /configuracion/.test(p.href);
          return (
            <li key={p.titulo} className="flex flex-wrap items-center gap-5 px-6 py-5 sm:flex-nowrap">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primario-suave text-primario">
                <Icono className="size-7" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1 text-[15px] leading-6 text-[#344054] dark:text-texto-2">
                <p className="font-medium text-[#101828] dark:text-texto">{p.titulo}</p>
                <p>{p.texto}</p>
              </div>
              <div className="flex w-[170px] shrink-0 items-center justify-center gap-1">
                {p.hecho ? (
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#16803c] text-white" title="Completado" aria-label="Completado">
                    <Check className="size-7" strokeWidth={2.5} />
                  </span>
                ) : soloAdmin ? (
                  <span className="text-center text-xs text-tenue">Lo hace un administrador</span>
                ) : (
                  <>
                    {'copiar' in p && p.copiar && <BotonCopiar texto={p.copiar} />}
                    <Link href={p.href} target={'externo' in p && p.externo ? '_blank' : undefined} className={verde}>{p.boton}</Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
