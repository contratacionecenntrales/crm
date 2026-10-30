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
      hecho: Boolean(subcuenta.email && subcuenta.telefono && subcuenta.direccion), href: `${base}/configuracion`, boton: 'Completar perfil' },
    { icono: Users, titulo: 'Invita a tu equipo', texto: 'Da acceso a las personas que atenderán contactos, citas y mensajes.',
      hecho: equipo > 0, href: `${base}/configuracion/usuarios`, boton: 'Añadir usuarios' },
    { icono: BookUser, titulo: 'Importa tus contactos', texto: 'Sube un CSV o crea tus primeros contactos a mano.',
      hecho: contactos > 0, href: `${base}/contactos?importar=1`, boton: 'Importar contactos' },
    { icono: MessageSquare, titulo: 'Conecta SMS y WhatsApp', texto: 'Conecta tu cuenta de Twilio para escribir y recibir mensajes desde Conversaciones.',
      hecho: Boolean(a?.twilio_sid && a?.twilio_numero_sms && s.twilio_token), href: `${base}/configuracion/telefonia`, boton: 'Conectar Twilio' },
    { icono: Mail, titulo: 'Configura el correo', texto: 'Mailgun o SMTP para enviar correos, confirmaciones y recordatorios.',
      hecho: correoListo, href: `${base}/configuracion/correo`, boton: 'Configurar correo' },
    { icono: CalendarDays, titulo: 'Crea tu calendario', texto: 'Define tu horario y comparte el enlace para que te reserven citas.',
      hecho: calendarios > 0, href: `${base}/calendarios/configuracion`, boton: 'Crear calendario' },
    { icono: CalendarCheck2, titulo: 'Recibe tu primera reserva online', texto: 'Comparte tu página de reserva en tu web, redes o WhatsApp.',
      hecho: reservas > 0, href: primerCal.data ? `/reservar/${primerCal.data.slug}` : `${base}/calendarios/configuracion`,
      boton: primerCal.data ? 'Abrir página de reserva' : 'Crea antes un calendario', externo: Boolean(primerCal.data),
      copiar: primerCal.data ? `${web}/reservar/${primerCal.data.slug}` : null },
    { icono: Network, titulo: 'Crea tu primera oportunidad', texto: 'Sigue cada venta en tu embudo, de nuevo lead a cerrado.',
      hecho: oportunidades > 0, href: `${base}/oportunidades?nueva=1`, boton: 'Crear oportunidad' },
  ];
  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 font-sans sm:p-6">
      <section className="rounded-lg border border-borde bg-superficie p-6">
        <h1 className="text-2xl font-semibold text-texto">Emprendamos juntos el camino del éxito</h1>
        <p className="mt-1 text-sm text-tenue">
          {hechos === pasos.length ? '¡Todo listo! Tu cuenta está configurada.' : `Completa estos pasos para sacar todo el partido a ${subcuenta.nombre}.`}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eaecf0]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-exito transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-medium text-texto">{hechos} de {pasos.length} completados</span>
        </div>
      </section>

      <ol className="space-y-3">
        {pasos.map((p, i) => {
          const Icono = p.icono;
          const soloAdmin = !soyAdmin && /configuracion/.test(p.href);
          return (
            <li key={p.titulo} className={`flex flex-wrap items-center gap-4 rounded-lg border bg-superficie p-4 ${p.hecho ? 'border-borde' : 'border-[#b2ccff]'}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${p.hecho ? 'bg-[#dcfae6] text-[#067647]' : 'bg-primario-suave text-primario'}`}>
                {p.hecho ? <Check className="size-5" /> : <Icono className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${p.hecho ? 'text-tenue line-through' : 'text-texto'}`}><span className="text-tenue">{i + 1}.</span> {p.titulo}</p>
                <p className="text-sm text-tenue">{p.texto}</p>
              </div>
              {p.hecho ? (
                <span className="rounded-full bg-[#dcfae6] px-2.5 py-0.5 text-xs font-medium text-[#067647]">Completado</span>
              ) : soloAdmin ? (
                <span className="text-xs text-tenue">Lo hace un administrador</span>
              ) : (
                <div className="flex items-center gap-1">
                  {'copiar' in p && p.copiar && <BotonCopiar texto={p.copiar} />}
                  <Link href={p.href} target={'externo' in p && p.externo ? '_blank' : undefined}
                    className="inline-flex h-9 items-center rounded-lg bg-primario px-3.5 text-sm font-semibold text-white shadow-xs hover:bg-primario-hover">
                    {p.boton}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
