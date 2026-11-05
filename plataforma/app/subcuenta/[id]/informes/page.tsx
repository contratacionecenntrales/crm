import { subcuentaVisible } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { Informes, type DatosInforme } from '@/components/informes/Informes';

export const metadata = { title: 'Informes' };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function PaginaInformes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const { subcuenta } = await subcuentaVisible(id);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: subcuenta.zona_horaria || 'Europe/Madrid' }).format(new Date());
  const menos = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
  let hasta = q.hasta && FECHA.test(q.hasta) ? q.hasta : hoy;
  let desde = q.desde && FECHA.test(q.desde) ? q.desde : menos(hasta, 29);
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (Date.parse(hasta) - Date.parse(desde) > 365 * 864e5) desde = menos(hasta, 365);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('inf_resumen', { p_subcuenta: id, p_desde: desde, p_hasta: hasta });
  if (error) throw new Error(error.message);
  return <Informes subId={id} desde={desde} hasta={hasta} hoy={hoy} d={data as DatosInforme} />;
}
