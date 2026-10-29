import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { asignablesDe, camposDe, etiquetasDe } from '@/lib/crm/datos';
import { leerFiltros, leerOrden, leerPagina } from '@/lib/crm/filtros';
import { consultaContactos } from '@/lib/crm/consultaContactos';
import { TablaContactos } from '@/components/crm/TablaContactos';
import type { Contacto, ListaInteligente } from '@/lib/crm/tipos';

export const metadata = { title: 'Contactos' };

type Busqueda = { q?: string; f?: string; o?: string; p?: string; n?: string; lista?: string };

export default async function PaginaContactos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Busqueda> }) {
  const { id } = await params;
  const sp = await searchParams;
  const usuario = await usuarioActual();
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();

  const { data: listasDatos } = await supabase
    .from('crm_listas')
    .select('id, nombre, filtros, busqueda, orden, columnas, compartida, propietario_id')
    .eq('subcuenta_id', id)
    .order('creado');
  const listas = (listasDatos ?? []) as ListaInteligente[];
  const lista = listas.find((l) => l.id === sp.lista) ?? null;

  // Lo que venga en la URL manda sobre lo guardado en la lista.
  const filtros = sp.f !== undefined ? leerFiltros(sp.f) : lista?.filtros ?? [];
  const busqueda = (sp.q ?? lista?.busqueda ?? '').slice(0, 200);
  const orden = leerOrden(sp.o ?? lista?.orden);
  const { pagina, tam, desde, hasta } = leerPagina(sp.p, sp.n);

  const [campos, asignables, etiquetas, resultado] = await Promise.all([
    camposDe(id),
    asignablesDe(id),
    etiquetasDe(id),
    consultaContactos(supabase, id, { filtros, busqueda, orden, desde, hasta }),
  ]);
  if (resultado.error && resultado.error.code !== 'PGRST103') throw new Error(resultado.error.message);

  return (
    <TablaContactos
      subId={id}
      contactos={(resultado.data ?? []) as unknown as Contacto[]}
      total={resultado.count ?? 0}
      pagina={pagina}
      tam={tam}
      filtros={filtros}
      busqueda={busqueda}
      orden={`${orden.columna}.${orden.asc ? 'asc' : 'desc'}`}
      listas={listas}
      listaActual={lista}
      campos={campos}
      asignables={asignables}
      etiquetas={etiquetas}
      zona={subcuenta.zona_horaria}
      yo={usuario.id}
      soyAdmin={soyAdmin}
    />
  );
}
