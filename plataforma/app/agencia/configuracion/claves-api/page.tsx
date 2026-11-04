import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { GestorClavesApi } from '@/components/ajustes/ClavesApi';
import type { ClaveApi } from '@/lib/api/permisos';

export const metadata = { title: 'Claves de API' };

export default async function PaginaClavesApi() {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, subs] = await Promise.all([
    supabase.from('api_claves').select('id, nombre, prefijo, permisos, subcuentas, creado, ultimo_uso, caduca, revocada_en')
      .eq('agencia_id', actual.agencia.id).order('creado', { ascending: false }),
    supabase.from('subcuentas').select('id, nombre').eq('agencia_id', actual.agencia.id).order('nombre'),
  ]);
  if (error) throw new Error(error.message);
  return (
    <div className="px-4 py-6 sm:px-6">
      <GestorClavesApi claves={(data ?? []) as ClaveApi[]} subcuentas={(subs.data ?? []) as { id: string; nombre: string }[]}
        web={siteUrl()} zona={actual.agencia.zona_horaria} />
    </div>
  );
}
