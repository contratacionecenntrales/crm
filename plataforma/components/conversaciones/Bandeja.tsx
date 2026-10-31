'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Archive, ArrowUpDown, Clock, Inbox, Mail, MessageSquare, MessagesSquare, Search, SquarePen, Star, User, UserX, X,
} from 'lucide-react';
import { conversacionesLote, destacar } from '@/app/subcuenta/[id]/conversaciones/acciones';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { Modal } from '@/components/ui/Modal';
import { estilosBoton } from '@/components/ui/clases';
import { nombreContacto, type Contacto, type Usuario } from '@/lib/crm/tipos';
import type { Conversacion, Fragmento, Mensaje } from '@/lib/conversaciones/tipos';
import { Chat } from './Chat';
import { PanelContacto } from './PanelContacto';

export type Filtro = 'no_leidos' | 'todo' | 'reciente' | 'destacado';
export type Buzon = 'equipo' | 'mias' | 'sin_asignar' | 'cerradas';

const BUZONES: { v: Buzon; texto: string; icono: typeof Inbox }[] = [
  { v: 'equipo', texto: 'Bandeja de entrada del equipo', icono: MessagesSquare },
  { v: 'mias', texto: 'Mis conversaciones', icono: User },
  { v: 'sin_asignar', texto: 'Sin asignar', icono: UserX },
  { v: 'cerradas', texto: 'Conversaciones cerradas', icono: Archive },
];
const FILTROS: { v: Filtro; texto: string; icono: typeof Inbox }[] = [
  { v: 'no_leidos', texto: 'No leído', icono: Mail },
  { v: 'todo', texto: 'Todo', icono: Inbox },
  { v: 'reciente', texto: 'Reciente', icono: Clock },
  { v: 'destacado', texto: 'Destacado', icono: Star },
];
const PASTEL = ['#fce7f6', '#e0f2fe', '#dcfae6', '#fef0c7', '#ebe9fe', '#ffe4e8', '#d1fadf', '#fdead7'];
const TINTA = ['#c11574', '#026aa2', '#067647', '#b54708', '#5925dc', '#c01048', '#05603a', '#b93815'];
export function colorAvatar(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { fondo: PASTEL[h % PASTEL.length], tinta: TINTA[h % TINTA.length] };
}
export function iniciales(c: { nombre: string; apellidos: string; email: string | null; telefono: string }) {
  const n = `${c.nombre} ${c.apellidos}`.trim();
  if (n) return n.split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  return (c.email ?? c.telefono).replace(/^\+/, '').slice(0, 2).toUpperCase();
}

export function AvatarContacto({ c, tam = 32 }: { c: Conversacion['contacto']; tam?: number }) {
  const col = colorAvatar(c.id);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
      style={{ width: tam, height: tam, background: col.fondo, color: col.tinta }}>{iniciales(c)}</span>
  );
}

interface Props {
  subId: string;
  zona: string;
  yo: string;
  soyAdmin: boolean;
  filtro: Filtro;
  buzon: Buzon;
  orden: 'asc' | 'desc';
  texto: string;
  conversaciones: Conversacion[];
  actual: Conversacion | null;
  contacto: Contacto | null;
  mensajes: Mensaje[];
  fragmentos: Fragmento[];
  asignables: Usuario[];
  etiquetas: string[];
  canales: { sms: boolean; whatsapp: boolean; email: boolean };
}

export function Bandeja(p: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const q = useSearchParams();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [buscando, setBuscando] = useState(Boolean(p.texto));
  const [texto, setTexto] = useState(p.texto);
  const [nuevo, setNuevo] = useState(q.get('nuevo') === '1');
  const [panel, setPanel] = useState(true);
  const [pendiente, iniciar] = useTransition();

  const url = (cambios: Record<string, string | null>) => {
    const u = new URLSearchParams(q.toString());
    for (const [k, v] of Object.entries(cambios)) if (v) u.set(k, v); else u.delete(k);
    const s = u.toString();
    return s ? `${ruta}?${s}` : ruta;
  };

  // Búsqueda con pausa para no recargar en cada tecla.
  useEffect(() => {
    if (texto === p.texto) return;
    const t = setTimeout(() => router.replace(url({ q: texto.trim() || null })), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  // Tiempo real: cualquier mensaje o cambio en la subcuenta refresca la vista.
  const refresco = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let supabase: ReturnType<typeof crearClienteNavegador>;
    try {
      supabase = crearClienteNavegador();
    } catch {
      return;
    }
    const recargar = () => {
      if (refresco.current) clearTimeout(refresco.current);
      refresco.current = setTimeout(() => router.refresh(), 400);
    };
    const canal = supabase.channel(`conversaciones:${p.subId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conv_mensajes', filter: `subcuenta_id=eq.${p.subId}` }, recargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conv_conversaciones', filter: `subcuenta_id=eq.${p.subId}` }, recargar)
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [p.subId, router]);

  const noLeidas = useMemo(() => p.conversaciones.filter((c) => c.no_leidos > 0).length, [p.conversaciones]);
  const titulo = BUZONES.find((b) => b.v === p.buzon)!.texto;
  const todas = p.conversaciones.length > 0 && p.conversaciones.every((c) => seleccion.has(c.id));
  const lote = (accion: Parameters<typeof conversacionesLote>[2]) => iniciar(async () => {
    const r = await conversacionesLote(p.subId, [...seleccion], accion);
    if (r.ok) setSeleccion(new Set()); else alert(r.error);
  });

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: p.zona }).format(new Date());
  const fechaFila = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: p.zona }).format(d);
    return dia === hoy
      ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: p.zona }).format(d)
      : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: p.zona }).format(d).replace('.', '');
  };

  const contactoChat = p.actual?.contacto ?? (p.contacto ? { id: p.contacto.id, nombre: p.contacto.nombre, apellidos: p.contacto.apellidos, email: p.contacto.email, telefono: p.contacto.telefono } : null);

  return (
    <div className="flex h-[calc(100dvh-93px)] min-h-[520px] gap-2 bg-fondo p-1 font-sans sm:gap-3 sm:p-2">
      {/* Buzones */}
      <nav className={`w-[52px] shrink-0 flex-col items-center gap-2 pt-2 ${contactoChat ? 'hidden md:flex' : 'flex'}`} aria-label="Buzones">
        {BUZONES.map((b, i) => {
          const on = p.buzon === b.v;
          const Icono = b.icono;
          return (
            <span key={b.v} className="contents">
              {i === 3 && <span aria-hidden className="my-1 h-px w-8 bg-borde-fuerte" />}
              <Link href={url({ b: b.v === 'equipo' ? null : b.v, c: null, contacto: null })} title={b.texto} aria-label={b.texto} aria-current={on ? 'page' : undefined}
                className={`flex size-[38px] items-center justify-center rounded ${on ? 'bg-primario text-white' : 'text-[#475467] dark:text-texto-2 hover:bg-superficie'}`}>
                <Icono className="size-5" strokeWidth={1.75} />
              </Link>
            </span>
          );
        })}
        <span aria-hidden className="my-1 h-px w-8 bg-borde-fuerte" />
        <button type="button" onClick={() => setNuevo(true)} title="Nuevo mensaje" aria-label="Nuevo mensaje"
          className="flex size-[38px] items-center justify-center rounded text-[#475467] dark:text-texto-2 hover:bg-superficie">
          <SquarePen className="size-5" strokeWidth={1.75} />
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg bg-superficie">
        {/* Lista */}
        <section className={`flex w-full shrink-0 flex-col border-r border-borde md:w-[320px] ${contactoChat ? 'hidden md:flex' : 'flex'}`} aria-label="Conversaciones">
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="m-0.5 min-w-0 truncate text-[16px] font-semibold leading-[19px] text-[#101828] dark:text-texto">{titulo}</h1>
              <div className="flex shrink-0 items-center gap-1 text-[#475467] dark:text-texto-2">
                <button type="button" onClick={() => setBuscando((v) => !v)} title="Buscar" aria-label="Buscar" className="rounded p-1 hover:bg-superficie-2"><Search className="size-5" /></button>
                <Link href={url({ o: p.orden === 'desc' ? 'asc' : null })} title={p.orden === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
                  aria-label="Cambiar orden" className="rounded p-1 hover:bg-superficie-2"><ArrowUpDown className="size-5" /></Link>
              </div>
            </div>
            {buscando && (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
                <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre, correo o teléfono"
                  className="h-9 w-full rounded-lg border border-borde-fuerte bg-superficie pl-8 pr-8 text-sm text-texto shadow-xs focus:border-primario focus:outline-none" />
                {texto && <button type="button" onClick={() => setTexto('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-tenue"><X className="size-4" /></button>}
              </div>
            )}
            <div className="mt-3 grid grid-cols-4 border-b border-borde">
              {FILTROS.map((f) => {
                const on = p.filtro === f.v;
                const Icono = f.icono;
                return (
                  <Link key={f.v} href={url({ f: f.v === 'todo' ? null : f.v })} aria-current={on ? 'page' : undefined}
                    className={`-mb-px flex flex-col items-center gap-1 border-b-2 pb-2 pt-1 ${on ? 'border-primario' : 'border-transparent hover:border-borde-fuerte'}`}>
                    <span className="relative">
                      <Icono className={`size-5 ${on ? 'text-[#101828] dark:text-texto' : 'text-[#667085]'}`} strokeWidth={1.75} />
                      {f.v === 'no_leidos' && noLeidas > 0 && (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded bg-primario px-1 text-center text-[10px] font-semibold leading-4 text-white">{noLeidas}</span>
                      )}
                    </span>
                    <span className="w-full truncate text-center text-sm font-medium leading-5 text-[#101828] dark:text-texto">{f.texto}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex min-h-11 items-center gap-2 py-2">
              <label className="flex items-center gap-2 text-sm text-[#344054] dark:text-texto-2">
                <input type="checkbox" checked={todas} disabled={!p.conversaciones.length} className="size-4"
                  onChange={(e) => setSeleccion(e.target.checked ? new Set(p.conversaciones.map((c) => c.id)) : new Set())} />
                {seleccion.size ? `${seleccion.size} seleccionadas` : 'Seleccionar todo'}
              </label>
              {seleccion.size > 0 && (
                <div className={`ml-auto flex gap-1 ${pendiente ? 'opacity-60' : ''}`}>
                  <button type="button" onClick={() => lote('leidas')} className="rounded px-2 py-1 text-xs font-medium text-primario-texto hover:bg-primario-suave">Leídas</button>
                  <button type="button" onClick={() => lote('no_leidas')} className="rounded px-2 py-1 text-xs font-medium text-primario-texto hover:bg-primario-suave">No leídas</button>
                  <button type="button" onClick={() => lote(p.buzon === 'cerradas' ? 'abrir' : 'cerrar')} className="rounded px-2 py-1 text-xs font-medium text-primario-texto hover:bg-primario-suave">
                    {p.buzon === 'cerradas' ? 'Reabrir' : 'Cerrar'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4">
            {p.conversaciones.length === 0 && (
              <li className="py-10 text-center text-sm text-tenue">
                {p.texto ? 'Ninguna conversación coincide con la búsqueda.' : 'No hay conversaciones aquí.'}
              </li>
            )}
            {p.conversaciones.map((c) => {
              const on = p.actual?.id === c.id;
              return (
                <li key={c.id}>
                  <div className={`group flex gap-2 rounded-lg border px-2.5 py-3 ${on ? 'border-primario' : 'border-transparent hover:bg-superficie-2'}`}>
                    <input type="checkbox" aria-label="Seleccionar" checked={seleccion.has(c.id)} className="mt-2 size-4 shrink-0"
                      onChange={(e) => setSeleccion((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                    <Link href={url({ c: c.id, contacto: null })} className="flex min-w-0 flex-1 gap-3">
                      <span className="relative mt-0.5">
                        <AvatarContacto c={c.contacto} />
                        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-superficie text-primario">
                          {c.ultimo_canal === 'email' ? <Mail className="size-3" /> : c.ultimo_canal === 'chat' ? <MessagesSquare className="size-3" /> : <MessageSquare className="size-3" />}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`truncate text-[14px] leading-[21px] text-[#475467] dark:text-texto-2 ${c.no_leidos ? 'font-bold' : 'font-semibold'}`}>{nombreContacto(c.contacto)}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <span className="whitespace-nowrap text-[12px] leading-[18px] text-[#667085] dark:text-tenue" suppressHydrationWarning>{fechaFila(c.ultimo_mensaje_en)}</span>
                            {c.no_leidos > 0 && <span className="min-w-4 rounded bg-primario px-1 text-center text-[11px] font-semibold leading-4 text-white">{c.no_leidos}</span>}
                          </span>
                        </span>
                        <span className={`truncate text-[14px] leading-[21px] ${c.no_leidos ? 'text-[#344054] dark:text-texto' : 'text-tenue'}`}>
                          {c.ultima_direccion === 'saliente' && 'Tú: '}{c.ultimo_extracto || 'Sin mensajes'}
                        </span>
                      </span>
                    </Link>
                    <button type="button" aria-label={c.destacada ? 'Quitar de destacadas' : 'Destacar'} title={c.destacada ? 'Quitar de destacadas' : 'Destacar'}
                      onClick={() => iniciar(async () => void (await destacar(p.subId, c.id, !c.destacada)))}
                      className={`self-end rounded p-0.5 ${c.destacada ? 'text-[#f79009]' : 'text-[#98a2b3] opacity-0 hover:text-[#f79009] group-hover:opacity-100'}`}>
                      <Star className={`size-4 ${c.destacada ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Chat */}
        {contactoChat ? (
          <Chat
            key={contactoChat.id}
            subId={p.subId} zona={p.zona} yo={p.yo} soyAdmin={p.soyAdmin}
            conversacion={p.actual} contacto={contactoChat} contactoCompleto={p.contacto} mensajes={p.mensajes}
            fragmentos={p.fragmentos} asignables={p.asignables} canales={p.canales}
            volver={url({ c: null, contacto: null })} panelAbierto={panel} alPanel={() => setPanel((v) => !v)}
            alCreada={(id) => router.replace(url({ c: id, contacto: null }))}
          />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-6 text-center md:flex">
            <span className="flex size-14 items-center justify-center rounded-full bg-primario-suave text-primario"><MessagesSquare className="size-7" /></span>
            <p className="text-base font-semibold text-texto">Elige una conversación</p>
            <p className="max-w-sm text-sm text-tenue">O escribe a cualquier contacto por SMS, WhatsApp o correo.</p>
            <button type="button" onClick={() => setNuevo(true)} className={estilosBoton.primario}><SquarePen className="size-4" /> Nuevo mensaje</button>
          </div>
        )}
      </div>

      {contactoChat && p.contacto && panel && (
        <PanelContacto subId={p.subId} contacto={p.contacto} asignables={p.asignables} etiquetas={p.etiquetas} alCerrar={() => setPanel(false)} />
      )}

      <Modal abierto={nuevo} alCerrar={() => setNuevo(false)} titulo="Nuevo mensaje" ancho="max-w-md">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const id = new FormData(e.currentTarget).get('contacto_id');
          if (typeof id === 'string' && id) { setNuevo(false); router.push(url({ contacto: id, c: null })); }
        }}>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">¿A quién quieres escribir?</span>
            <SelectorContacto subId={p.subId} name="contacto_id" requerido />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNuevo(false)} className={estilosBoton.secundario}>Cancelar</button>
            <button className={estilosBoton.primario}>Abrir conversación</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
