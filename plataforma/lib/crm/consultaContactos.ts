import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarFiltros, escaparLike, type Constructor } from './filtros';
import type { Filtro } from './tipos';

export const SELECT_CONTACTO =
  'id, subcuenta_id, nombre, apellidos, email, telefono, empresa_id, tipo, fuente, direccion, ciudad, provincia, codigo_postal, pais, web, ' +
  'fecha_nacimiento, zona_horaria, propietario_id, etiquetas, dnd, dnd_canales, campos, ultima_actividad, creado, actualizado, empresa:crm_empresas(nombre)';

// Monta la consulta de contactos con búsqueda, filtros y orden (sin paginar).
export async function consultaContactos(
  supabase: SupabaseClient,
  subId: string,
  opciones: {
    filtros: Filtro[];
    busqueda: string;
    orden: { columna: string; asc: boolean };
    desde: number;
    hasta: number;
    ids?: string[];
    conteo?: boolean;
  },
): Promise<{ data: unknown[] | null; count: number | null; error: { message: string; code?: string } | null }> {
  // El filtro por nombre de empresa se resuelve antes con los ids que coinciden.
  const idsEmpresas: Record<string, string[]> = {};
  for (const f of opciones.filtros) {
    if (f.campo === 'empresa' && f.op === 'contiene' && f.valor?.trim()) {
      const v = f.valor.trim().toLowerCase();
      const { data } = await supabase.from('crm_empresas').select('id').eq('subcuenta_id', subId).ilike('nombre', `%${escaparLike(v)}%`).limit(1000);
      idsEmpresas[v] = (data ?? []).map((e) => e.id as string);
    }
  }

  // El constructor de supabase-js tiene tipos demasiado profundos para pasarlo
  // por una función genérica; se trata como `any` solo dentro de este bloque.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('crm_contactos')
    .select(SELECT_CONTACTO, opciones.conteo === false ? undefined : { count: 'exact' })
    .eq('subcuenta_id', subId);
  const texto = opciones.busqueda.trim().toLowerCase();
  if (texto) q = q.ilike('busqueda', `%${escaparLike(texto)}%`);
  if (opciones.ids?.length) q = q.in('id', opciones.ids);
  const consulta = aplicarFiltros(q as Constructor<typeof q>, opciones.filtros, { idsEmpresas }).consulta as typeof q;
  // OJO: el constructor es «thenable»; no se devuelve sin ejecutar desde una
  // función async (se ejecutaría antes de paginar). Se pagina y se espera aquí.
  return await consulta
    .order(opciones.orden.columna, { ascending: opciones.orden.asc, nullsFirst: false })
    .order('id', { ascending: true })
    .range(opciones.desde, opciones.hasta);
}
