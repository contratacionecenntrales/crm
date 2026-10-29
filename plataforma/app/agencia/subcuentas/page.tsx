import { crearClienteServidor } from '@/lib/supabase/server';
import { esAdminAgencia, exigirAgencia } from '@/lib/sesion';
import { ListaSubcuentas } from '@/components/agencia/ListaSubcuentas';
import type { Pago, Subcuenta, Suscripcion } from '@/lib/tipos';

export const metadata = { title: 'Subcuentas' };

export default async function PaginaSubcuentas() {
  const { actual } = await exigirAgencia();
  const admin = esAdminAgencia(actual.rol);
  const supabase = await crearClienteServidor();

  const { data: subs, error } = await supabase
    .from('subcuentas')
    .select('*')
    .eq('agencia_id', actual.agencia.id)
    .order('creado', { ascending: true });
  if (error) throw new Error(error.message);

  const suscripciones: Record<string, Suscripcion> = {};
  const pagos: Record<string, Pago[]> = {};
  if (admin) {
    const [s, p] = await Promise.all([
      supabase.from('suscripciones').select('*').eq('agencia_id', actual.agencia.id),
      supabase
        .from('pagos')
        .select('id, subcuenta_id, importe, concepto, fecha, origen')
        .eq('agencia_id', actual.agencia.id)
        .order('fecha', { ascending: false })
        .limit(500),
    ]);
    for (const x of (s.data ?? []) as Suscripcion[]) suscripciones[x.subcuenta_id] = x;
    for (const x of (p.data ?? []) as Pago[]) {
      if (!x.subcuenta_id) continue;
      (pagos[x.subcuenta_id] ??= []).length < 20 && pagos[x.subcuenta_id].push(x);
    }
  }

  return (
    <ListaSubcuentas
      subcuentas={(subs ?? []) as Subcuenta[]}
      suscripciones={suscripciones}
      pagos={pagos}
      moneda={actual.agencia.moneda}
      zona={actual.agencia.zona_horaria}
      esAdmin={admin}
    />
  );
}
