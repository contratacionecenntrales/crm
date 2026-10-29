import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/server';
import { leerFiltros, leerOrden } from '@/lib/crm/filtros';
import { consultaContactos } from '@/lib/crm/consultaContactos';
import { escribirCsv } from '@/lib/crm/csv';
import type { Campo, Contacto, ListaInteligente } from '@/lib/crm/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 50_000;
const BLOQUE = 1000;

// Descarga en CSV los contactos que coinciden con la vista actual (o los
// seleccionados) y deja constancia en Acciones en lote.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Subcuenta no válida' }, { status: 400 });
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
  const { data: puede } = await supabase.rpc('puedo_ver_subcuenta', { p_subcuenta: id });
  if (!puede) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  let lista: ListaInteligente | null = null;
  if (sp.get('lista') && UUID.test(sp.get('lista')!)) {
    const { data } = await supabase.from('crm_listas').select('*').eq('id', sp.get('lista')!).eq('subcuenta_id', id).maybeSingle();
    lista = data as ListaInteligente | null;
  }
  const filtros = sp.has('f') ? leerFiltros(sp.get('f')) : lista?.filtros ?? [];
  const busqueda = sp.get('q') ?? lista?.busqueda ?? '';
  const orden = leerOrden(sp.get('o') ?? lista?.orden);
  const ids = (sp.get('ids') ?? '').split(',').filter((x) => UUID.test(x)).slice(0, 5000);

  const [{ data: camposDatos }, { data: usuarios }] = await Promise.all([
    supabase.from('crm_campos').select('clave, nombre, tipo').eq('subcuenta_id', id).order('carpeta').order('orden'),
    supabase.rpc('usuarios_asignables', { p_subcuenta: id }),
  ]);
  const campos = (camposDatos ?? []) as Pick<Campo, 'clave' | 'nombre' | 'tipo'>[];
  const nombreUsuario = new Map(((usuarios ?? []) as { usuario_id: string; email: string; nombre: string }[]).map((u) => [u.usuario_id, u.nombre || u.email]));

  const filas: unknown[][] = [];
  for (let desde = 0; desde < MAX; desde += BLOQUE) {
    const { data, error } = await consultaContactos(supabase, id, {
      filtros, busqueda, orden, ids: ids.length ? ids : undefined, conteo: false, desde, hasta: desde + BLOQUE - 1,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const lote = (data ?? []) as unknown as Contacto[];
    for (const c of lote) {
      filas.push([
        c.id, c.nombre, c.apellidos, c.email ?? '', c.telefono, c.empresa?.nombre ?? '', c.tipo === 'cliente' ? 'Cliente' : 'Lead',
        c.fuente, c.etiquetas, nombreUsuario.get(c.propietario_id ?? '') ?? '', c.direccion, c.ciudad, c.provincia, c.codigo_postal,
        c.pais, c.web, c.fecha_nacimiento ?? '', c.dnd ? 'Sí' : 'No', c.creado, c.ultima_actividad ?? '',
        ...campos.map((k) => {
          const v = c.campos?.[k.clave];
          return typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v ?? '';
        }),
      ]);
    }
    if (lote.length < BLOQUE) break;
  }

  const cabecera = [
    'ID', 'Nombre', 'Apellidos', 'Correo electrónico', 'Teléfono', 'Nombre de la empresa', 'Tipo de contacto', 'Fuente', 'Etiquetas',
    'Propietario', 'Dirección', 'Ciudad', 'Provincia', 'Código postal', 'País', 'Sitio web', 'Fecha de nacimiento', 'No molestar',
    'Creado', 'Última actividad', ...campos.map((c) => c.nombre),
  ];
  const ahora = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const nombre = `Export_Contacts_${ids.length ? 'Seleccion' : 'All'}_${ahora.getFullYear()}-${p2(ahora.getMonth() + 1)}-${p2(ahora.getDate())}_${p2(ahora.getHours())}${p2(ahora.getMinutes())}.csv`;

  await supabase.from('crm_acciones_lote').insert({
    subcuenta_id: id, etiqueta: nombre, operacion: 'exportar', estado: 'completada', total: filas.length, correctos: filas.length,
    detalle: { filtros, busqueda }, completado: new Date().toISOString(),
  });

  return new NextResponse(escribirCsv(cabecera, filas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
