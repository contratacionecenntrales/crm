import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { asignablesDe, etiquetasDe } from '@/lib/crm/datos';
import { SELECT_CONTACTO } from '@/lib/crm/consultaContactos';
import { escaparLike } from '@/lib/crm/filtros';
import { ajustesDe, canalesDisponibles } from '@/lib/conversaciones/datos';
import { COLUMNAS_CONVERSACION, COLUMNAS_MENSAJE, type Conversacion, type Fragmento, type Mensaje } from '@/lib/conversaciones/tipos';
import { Bandeja, type Filtro, type Buzon } from '@/components/conversaciones/Bandeja';
import type { Contacto } from '@/lib/crm/tipos';

export const metadata = { title: 'Conversaciones' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTROS: Filtro[] = ['no_leidos', 'todo', 'reciente', 'destacado'];
const BUZONES: Buzon[] = ['equipo', 'mias', 'sin_asignar', 'cerradas'];

export default async function PaginaConversaciones({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const [{ subcuenta, soyAdmin }, usuario, asignables, etiquetas, ajustes] = await Promise.all([
    subcuentaVisible(id), usuarioActual(), asignablesDe(id), etiquetasDe(id), ajustesDe(id),
  ]);
  const filtro: Filtro = FILTROS.includes(q.f as Filtro) ? (q.f as Filtro) : 'todo';
  const buzon: Buzon = BUZONES.includes(q.b as Buzon) ? (q.b as Buzon) : 'equipo';
  const orden = q.o === 'asc' ? 'asc' : 'desc';
  const texto = (q.q ?? '').trim().slice(0, 100);
  const supabase = await crearClienteServidor();

  let lista = supabase.from('conv_conversaciones').select(COLUMNAS_CONVERSACION).eq('subcuenta_id', id);
  lista = buzon === 'cerradas' ? lista.eq('estado', 'cerrada') : lista.eq('estado', 'abierta');
  if (buzon === 'mias') lista = lista.eq('asignado_id', usuario.id);
  if (buzon === 'sin_asignar') lista = lista.is('asignado_id', null);
  if (filtro === 'no_leidos') lista = lista.gt('no_leidos', 0);
  if (filtro === 'destacado') lista = lista.eq('destacada', true);
  if (filtro === 'reciente') lista = lista.gte('ultimo_mensaje_en', new Date(Date.now() - 7 * 86400_000).toISOString());
  if (texto) lista = lista.ilike('contacto.busqueda', `%${escaparLike(texto.toLowerCase())}%`);
  const conversaciones = await lista.order('ultimo_mensaje_en', { ascending: orden === 'asc', nullsFirst: false }).limit(200);
  if (conversaciones.error) throw new Error(conversaciones.error.message);
  const convs = conversaciones.data as unknown as Conversacion[];

  // Conversación abierta: por id (?c=) o por contacto (?contacto=, aunque aún no exista).
  let actual: Conversacion | null = null;
  let contactoId: string | null = null;
  if (q.c && UUID.test(q.c)) {
    actual = convs.find((c) => c.id === q.c) ?? null;
    if (!actual) {
      const { data } = await supabase.from('conv_conversaciones').select(COLUMNAS_CONVERSACION).eq('id', q.c).eq('subcuenta_id', id).maybeSingle();
      actual = (data as unknown as Conversacion) ?? null;
    }
    contactoId = actual?.contacto_id ?? null;
  } else if (q.contacto && UUID.test(q.contacto)) {
    const { data } = await supabase.from('conv_conversaciones').select(COLUMNAS_CONVERSACION).eq('contacto_id', q.contacto).eq('subcuenta_id', id).maybeSingle();
    actual = (data as unknown as Conversacion) ?? null;
    contactoId = q.contacto;
  }

  const [mensajes, contacto, fragmentos] = await Promise.all([
    actual
      ? supabase.from('conv_mensajes').select(COLUMNAS_MENSAJE).eq('conversacion_id', actual.id).order('creado', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] }),
    contactoId
      ? supabase.from('crm_contactos').select(SELECT_CONTACTO).eq('id', contactoId).eq('subcuenta_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('conv_fragmentos').select('id, nombre, cuerpo').eq('subcuenta_id', id).order('nombre').limit(500),
  ]);
  // Al abrir una conversación con mensajes sin leer, se marca como leída.
  if (actual && actual.no_leidos > 0) {
    await supabase.from('conv_conversaciones').update({ no_leidos: 0 }).eq('id', actual.id);
    const enLista = convs.find((c) => c.id === actual!.id);
    if (enLista) enLista.no_leidos = 0;
  }

  return (
    <Bandeja
      subId={id}
      zona={subcuenta.zona_horaria}
      yo={usuario.id}
      soyAdmin={soyAdmin}
      filtro={filtro}
      buzon={buzon}
      orden={orden}
      texto={texto}
      conversaciones={convs}
      actual={actual}
      contacto={(contacto.data as unknown as Contacto) ?? null}
      mensajes={((mensajes.data ?? []) as Mensaje[]).reverse()}
      fragmentos={(fragmentos.data ?? []) as Fragmento[]}
      asignables={asignables}
      etiquetas={etiquetas}
      canales={canalesDisponibles(ajustes)}
    />
  );
}
