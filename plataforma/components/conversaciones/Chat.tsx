'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, CheckCheck, CheckCircle2, ChevronDown, EllipsisVertical, FileText, Loader2, Mail, MailOpen,
  MessageCircle, MessageSquare, PanelRight, RotateCw, Send, StickyNote, Trash2, UserPlus,
} from 'lucide-react';
import {
  asignarConversacion, borrarConversacion, cerrarConversacion, enviarMensaje, marcarLeida, reintentarMensaje,
} from '@/app/subcuenta/[id]/conversaciones/acciones';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { NOMBRE_CANAL, segmentosSms, type Canal, type Conversacion, type Fragmento, type Mensaje } from '@/lib/conversaciones/tipos';
import { nombreContacto, type Contacto, type Usuario } from '@/lib/crm/tipos';
import { AvatarContacto } from './Bandeja';

const ICONO_CANAL: Record<Canal, typeof Mail> = { sms: MessageSquare, whatsapp: MessageCircle, email: Mail, nota: StickyNote };
const ESTADO: Record<string, string> = { pendiente: 'Enviando…', enviado: 'Enviado', entregado: 'Entregado', leido: 'Leído', fallido: 'No enviado', recibido: '' };

export function Chat({ subId, zona, yo, soyAdmin, conversacion, contacto, contactoCompleto, mensajes, fragmentos, asignables, canales, volver, panelAbierto, alPanel, alCreada }: {
  subId: string; zona: string; yo: string; soyAdmin: boolean;
  conversacion: Conversacion | null; contacto: Conversacion['contacto']; contactoCompleto: Contacto | null;
  mensajes: Mensaje[]; fragmentos: Fragmento[]; asignables: Usuario[];
  canales: { sms: boolean; whatsapp: boolean; email: boolean };
  volver: string; panelAbierto: boolean; alPanel: () => void; alCreada: (id: string) => void;
}) {
  const [lista, setLista] = useState(mensajes);
  useEffect(() => setLista(mensajes), [mensajes]);

  // Canal por defecto: el del último mensaje del cliente; si no, el primero disponible.
  const ultimoEntrante = [...mensajes].reverse().find((m) => m.direccion === 'entrante')?.canal;
  const inicial: Canal = ultimoEntrante && ultimoEntrante !== 'nota' && canales[ultimoEntrante] ? ultimoEntrante
    : contacto.telefono && canales.sms ? 'sms' : contacto.email && canales.email ? 'email' : canales.whatsapp && contacto.telefono ? 'whatsapp' : 'nota';
  const [canal, setCanal] = useState<Canal>(inicial);
  const ultimoAsunto = [...mensajes].reverse().find((m) => m.canal === 'email' && m.asunto)?.asunto;
  const [asunto, setAsunto] = useState(ultimoAsunto ? (/^re:/i.test(ultimoAsunto) ? ultimoAsunto : `Re: ${ultimoAsunto}`) : '');
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [menu, setMenu] = useState<null | 'canal' | 'fragmentos' | 'mas' | 'asignar'>(null);
  const caja = useRef<HTMLDivElement>(null);
  const cerrarMenu = () => setMenu(null);
  useFueraDe(caja, menu !== null, cerrarMenu);
  const fondo = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight });
  }, [lista.length]);
  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${Math.min(160, a.scrollHeight)}px`;
  }, [texto]);

  const dnd = contactoCompleto && (contactoCompleto.dnd || contactoCompleto.dnd_canales.includes(canal === 'email' ? 'email' : canal === 'whatsapp' ? 'whatsapp' : 'sms'));
  const falta = canal === 'email' ? (!contacto.email ? 'El contacto no tiene correo.' : null)
    : canal === 'nota' ? null : !contacto.telefono ? 'El contacto no tiene teléfono.' : null;

  const enviar = () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setError(null);
    const temporal: Mensaje = {
      id: `tmp-${Date.now()}`, direccion: 'saliente', canal, asunto: canal === 'email' ? asunto : '', cuerpo,
      estado: canal === 'nota' ? 'enviado' : 'pendiente', error: '', autor_id: yo, creado: new Date().toISOString(),
    };
    setLista((l) => [...l, temporal]);
    setTexto('');
    iniciar(async () => {
      const r = await enviarMensaje(subId, contacto.id, canal, cuerpo, asunto);
      if (!r.ok) {
        setError(r.error ?? 'No se pudo enviar.');
        if (!r.conversacionId) { setLista((l) => l.filter((m) => m.id !== temporal.id)); setTexto(cuerpo); }
      }
      if (!conversacion && r.conversacionId) alCreada(r.conversacionId);
    });
  };

  const dia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date(iso));
  const fechaChip = (iso: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zona }).format(new Date(iso));
  const hora = (iso: string) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: zona }).format(new Date(iso));
  const autor = (id: string | null) => {
    const u = asignables.find((x) => x.usuario_id === id);
    return u ? u.nombre || u.email.split('@')[0] : 'Sistema';
  };
  const asignado = asignables.find((u) => u.usuario_id === conversacion?.asignado_id);
  const seg = canal === 'sms' ? segmentosSms(texto) : null;
  const IconoCanal = ICONO_CANAL[canal];
  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>) => iniciar(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? 'Error'); });

  const grupos = useMemo(() => {
    const g: { dia: string; mensajes: Mensaje[] }[] = [];
    for (const m of lista) {
      const d = dia(m.creado);
      if (g.at(-1)?.dia !== d) g.push({ dia: d, mensajes: [] });
      g.at(-1)!.mensajes.push(m);
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, zona]);

  const opcion = 'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[#344054] hover:bg-superficie-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-texto-2';

  return (
    <section ref={caja} className="flex min-w-0 flex-1 flex-col" aria-label={`Conversación con ${nombreContacto(contacto)}`}>
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-borde px-4">
        <Link href={volver} className="rounded p-1 text-tenue md:hidden" aria-label="Volver a la lista"><ArrowLeft className="size-5" /></Link>
        <AvatarContacto c={contacto} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium leading-6 text-[#101828] dark:text-texto">{nombreContacto(contacto)}</p>
          {conversacion && (
            <p className="truncate text-xs text-tenue">
              {conversacion.estado === 'cerrada' ? 'Cerrada · ' : ''}Asignada a {asignado ? asignado.nombre || asignado.email : 'nadie'}
            </p>
          )}
        </div>
        {conversacion && (
          <div className="flex items-center gap-1 text-[#475467]">
            <div className="relative">
              <button type="button" onClick={() => setMenu(menu === 'asignar' ? null : 'asignar')} title="Asignar" aria-label="Asignar conversación" className="rounded p-1.5 hover:bg-superficie-2">
                <UserPlus className="size-5" />
              </button>
              {menu === 'asignar' && (
                <div className="absolute right-0 top-full z-30 mt-1 max-h-72 w-60 overflow-y-auto rounded-lg border bg-superficie p-1 shadow-lg">
                  <button type="button" className={opcion} onClick={() => { cerrarMenu(); accion(() => asignarConversacion(subId, conversacion.id, null)); }}>Sin asignar</button>
                  {asignables.map((u) => (
                    <button key={u.usuario_id} type="button" className={`${opcion} ${u.usuario_id === conversacion.asignado_id ? 'font-semibold text-primario-texto' : ''}`}
                      onClick={() => { cerrarMenu(); accion(() => asignarConversacion(subId, conversacion.id, u.usuario_id)); }}>
                      {u.nombre || u.email}{u.usuario_id === yo ? ' (yo)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" title={conversacion.estado === 'cerrada' ? 'Reabrir' : 'Cerrar conversación'} aria-label={conversacion.estado === 'cerrada' ? 'Reabrir' : 'Cerrar conversación'}
              onClick={() => accion(() => cerrarConversacion(subId, conversacion.id, conversacion.estado !== 'cerrada'))}
              className={`rounded p-1.5 hover:bg-superficie-2 ${conversacion.estado === 'cerrada' ? 'text-exito' : ''}`}>
              <CheckCircle2 className="size-5" />
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMenu(menu === 'mas' ? null : 'mas')} aria-label="Más opciones" className="rounded p-1.5 hover:bg-superficie-2">
                <EllipsisVertical className="size-5" />
              </button>
              {menu === 'mas' && (
                <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border bg-superficie p-1 shadow-lg">
                  <button type="button" className={opcion} onClick={() => { cerrarMenu(); accion(() => marcarLeida(subId, conversacion.id, false)); }}>
                    <MailOpen className="size-4" /> Marcar como no leída
                  </button>
                  <Link href={`/subcuenta/${subId}/contacto/${contacto.id}`} className={opcion}><FileText className="size-4" /> Ver ficha del contacto</Link>
                  {soyAdmin && (
                    <button type="button" className={`${opcion} text-peligro`} onClick={() => {
                      cerrarMenu();
                      if (confirm('¿Borrar la conversación y todos sus mensajes? No se puede deshacer.')) {
                        accion(async () => { const r = await borrarConversacion(subId, conversacion.id); if (r.ok) window.location.href = volver; return r; });
                      }
                    }}>
                      <Trash2 className="size-4" /> Borrar conversación
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <button type="button" onClick={alPanel} title={panelAbierto ? 'Ocultar detalles' : 'Ver detalles del contacto'} aria-label="Detalles del contacto"
          className={`hidden rounded p-1.5 hover:bg-superficie-2 xl:block ${panelAbierto ? 'text-primario' : 'text-[#475467]'}`}>
          <PanelRight className="size-5" />
        </button>
      </header>

      <div ref={fondo} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {lista.length === 0 && (
          <p className="py-16 text-center text-sm text-tenue">Todavía no hay mensajes. Escribe el primero abajo.</p>
        )}
        {grupos.map((g) => (
          <div key={g.dia}>
            <div className="flex justify-center pb-2 pt-6">
              <span className="inline-flex h-6 items-center rounded-full bg-[#f2f4f7] px-2.5 text-[13px] font-medium text-[#475467] dark:bg-superficie-2" suppressHydrationWarning>
                {fechaChip(g.mensajes[0].creado)}
              </span>
            </div>
            <ul className="space-y-3">
              {g.mensajes.map((m) => {
                const sale = m.direccion === 'saliente';
                const Ic = ICONO_CANAL[m.canal];
                const nota = m.canal === 'nota';
                return (
                  <li key={m.id} className={`flex items-end gap-2 ${sale ? 'justify-end' : 'justify-start'}`}>
                    {!sale && <AvatarContacto c={contacto} tam={28} />}
                    <div className={`flex max-w-[75%] flex-col ${sale ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-lg px-3 py-2 text-[14px] leading-[21px] text-[#101828] ${
                        nota ? 'border border-[#fedf89] bg-[#fffaeb]' : sale ? 'bg-[#eff4ff] dark:bg-primario-suave dark:text-texto' : 'bg-[#f2f4f7] dark:bg-superficie-2 dark:text-texto'}`}>
                        {nota && <p className="mb-1 flex items-center gap-1 text-xs font-medium text-[#b54708]"><StickyNote className="size-3.5" /> Comentario interno</p>}
                        {m.canal === 'email' && m.asunto && <p className="mb-1 font-semibold">{m.asunto}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.cuerpo}</p>
                        {m.estado === 'fallido' && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-[#fecdca] pt-2">
                            <p className="flex items-start gap-1.5 text-[13px] text-[#b42318]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{m.error || 'No se pudo enviar.'}</p>
                            {!m.id.startsWith('tmp-') && (
                              <button type="button" disabled={enviando} onClick={() => accion(() => reintentarMensaje(subId, m.id))}
                                className="flex items-center gap-1 self-end text-[13px] font-medium text-primario-texto hover:underline">
                                <RotateCw className="size-3.5" /> Vuelva a intentarlo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-[13px] text-[#475467] dark:text-texto-2" suppressHydrationWarning>
                        <Ic className="size-3" />
                        {sale && !nota && `${autor(m.autor_id)} · `}{hora(m.creado)}
                        {sale && !nota && ESTADO[m.estado] && (
                          <span className={`flex items-center gap-0.5 ${m.estado === 'fallido' ? 'text-[#b42318]' : m.estado === 'leido' ? 'text-primario' : ''}`}>
                            · {m.estado === 'pendiente' ? <Loader2 className="size-3 animate-spin" /> : m.estado === 'enviado' ? <Check className="size-3" /> : m.estado !== 'fallido' ? <CheckCheck className="size-3" /> : null}
                            {ESTADO[m.estado]}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 pb-4">
        {error && <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-lg bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        {dnd && canal !== 'nota' && <p className="mb-2 rounded-lg bg-[#fffaeb] px-3 py-2 text-sm text-[#b54708]">Este contacto tiene «No molestar» activado para {NOMBRE_CANAL[canal]}: el mensaje no se enviará.</p>}
        {falta && <p className="mb-2 rounded-lg bg-[#fffaeb] px-3 py-2 text-sm text-[#b54708]">{falta}</p>}
        <div className={`overflow-hidden rounded-lg border ${canal === 'nota' ? 'border-[#fedf89] bg-[#fffaeb]' : 'border-borde-fuerte bg-superficie'}`}>
          {canal === 'email' && (
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto" maxLength={300}
              className="h-10 w-full border-b border-borde bg-transparent px-3 text-sm text-texto focus:outline-none" />
          )}
          <div className="flex items-end">
            <div className="relative self-stretch border-r border-borde">
              <button type="button" onClick={() => setMenu(menu === 'canal' ? null : 'canal')} aria-label={`Canal: ${NOMBRE_CANAL[canal]}`} title={NOMBRE_CANAL[canal]}
                className="flex h-full min-h-10 items-center gap-1 px-3 text-primario">
                <IconoCanal className="size-4" /><ChevronDown className="size-3.5" />
              </button>
              {menu === 'canal' && (
                <div className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-lg border bg-superficie p-1 shadow-lg">
                  {(['sms', 'whatsapp', 'email', 'nota'] as Canal[]).map((c) => {
                    const Ic = ICONO_CANAL[c];
                    const listo = c === 'nota' || canales[c as 'sms' | 'whatsapp' | 'email'];
                    return (
                      <button key={c} type="button" disabled={!listo} className={`${opcion} ${c === canal ? 'font-semibold text-primario-texto' : ''}`}
                        onClick={() => { setCanal(c); cerrarMenu(); area.current?.focus(); }}>
                        <Ic className="size-4" /> {NOMBRE_CANAL[c]}
                        {!listo && <span className="ml-auto text-xs font-normal">sin configurar</span>}
                      </button>
                    );
                  })}
                  {(!canales.sms || !canales.email) && (
                    <Link href={`/subcuenta/${subId}/configuracion/${!canales.sms ? 'telefonia' : 'correo'}`} className="block px-3 py-2 text-xs font-medium text-primario-texto hover:underline">
                      Configurar canales →
                    </Link>
                  )}
                </div>
              )}
            </div>
            <textarea
              ref={area}
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (canal === 'email' ? e.ctrlKey || e.metaKey : !e.shiftKey)) { e.preventDefault(); enviar(); }
              }}
              placeholder={canal === 'nota' ? 'Escribe un comentario interno (solo lo ve el equipo)' : canal === 'email' ? 'Escribe el correo (Ctrl+Intro para enviar)' : 'Escribir un mensaje'}
              maxLength={canal === 'email' ? 20000 : 1600}
              className="min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-texto placeholder:text-[#667085] focus:outline-none"
            />
            <div className="flex items-center gap-1 self-stretch border-l border-borde px-2">
              <div className="relative">
                <button type="button" onClick={() => setMenu(menu === 'fragmentos' ? null : 'fragmentos')} title="Insertar fragmento" aria-label="Insertar fragmento"
                  className="rounded p-1.5 text-[#7a5af8] hover:bg-superficie-2"><FileText className="size-4" /></button>
                {menu === 'fragmentos' && (
                  <div className="absolute bottom-full right-0 z-30 mb-1 max-h-72 w-72 overflow-y-auto rounded-lg border bg-superficie p-1 shadow-lg">
                    {fragmentos.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-tenue">No hay fragmentos. <Link href={`/subcuenta/${subId}/conversaciones/fragmentos`} className="text-primario-texto underline">Crea uno</Link>.</p>
                    ) : fragmentos.map((f) => (
                      <button key={f.id} type="button" className={`${opcion} flex-col items-start gap-0`}
                        onClick={() => { setTexto((t) => (t ? `${t}\n${f.cuerpo}` : f.cuerpo)); cerrarMenu(); area.current?.focus(); }}>
                        <span className="font-medium">{f.nombre}</span>
                        <span className="line-clamp-1 text-xs text-tenue">{f.cuerpo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={enviar} disabled={!texto.trim() || enviando || Boolean(falta)} aria-label="Enviar"
                className="flex h-8 items-center rounded-md bg-primario px-2.5 text-white disabled:bg-[#b2ccff]">
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        {seg && seg.n > 0 && (
          <p className="mt-1 text-right text-xs text-tenue">{texto.length} caracteres · {seg.n} {seg.n === 1 ? 'SMS' : 'SMS (mensaje dividido)'}</p>
        )}
      </div>
    </section>
  );
}
