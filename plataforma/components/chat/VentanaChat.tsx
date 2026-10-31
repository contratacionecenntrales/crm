'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { enviarChat, iniciarChat, leerChat } from '@/app/chat/[clave]/acciones';
import type { ConfigChat, MensajeChat } from '@/lib/chat/tipos';

interface Sesion { token: string; nombre: string }

const hora = (iso: string) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// Guardado del visitante: solo en su navegador (si no hay almacenamiento, dura lo que la pestaña).
function leerSesion(clave: string): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(`chat-web:${clave}`) ?? 'null');
    return s && /^[0-9a-f]{64}$/.test(s.token) ? s : null;
  } catch {
    return null;
  }
}
function guardarSesion(clave: string, s: Sesion | null) {
  try {
    if (s) localStorage.setItem(`chat-web:${clave}`, JSON.stringify(s));
    else localStorage.removeItem(`chat-web:${clave}`);
  } catch {
    /* sin almacenamiento */
  }
}

export function VentanaChat({ clave, config, origen }: { clave: string; config: ConfigChat; origen: string }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [listo, setListo] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [enMarco, setEnMarco] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    setSesion(leerSesion(clave));
    setEnMarco(window.parent !== window);
    setListo(true);
  }, [clave]);

  const caducar = useCallback(() => {
    guardarSesion(clave, null);
    setSesion(null);
    setMensajes([]);
    ultimo.current = null;
  }, [clave]);

  const anadir = useCallback((nuevos: MensajeChat[]) => {
    if (!nuevos.length) return;
    setMensajes((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const todos = [...prev, ...nuevos.filter((m) => !ids.has(m.id))].sort((a, b) => a.creado.localeCompare(b.creado));
      ultimo.current = todos.at(-1)?.creado ?? ultimo.current;
      return todos;
    });
  }, []);

  // Carga inicial y consulta cada 4 s (solo con la pestaña visible).
  useEffect(() => {
    if (!sesion) return;
    let vivo = true;
    const traer = async () => {
      if (document.visibilityState === 'hidden') return;
      const r = await leerChat(clave, sesion.token, ultimo.current);
      if (!vivo) return;
      if (r.ok) anadir(r.datos);
      else if (r.caducado) caducar();
    };
    void traer();
    const t = setInterval(traer, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [sesion, clave, anadir, caducar]);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes.length, sesion]);

  const empezar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setOcupado(true);
    setError('');
    const r = await iniciarChat(clave, {
      nombre: String(fd.get('nombre') ?? ''), email: String(fd.get('email') ?? ''), telefono: String(fd.get('telefono') ?? ''), origen,
    });
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    guardarSesion(clave, r.datos);
    setSesion(r.datos);
    const primero = String(fd.get('mensaje') ?? '').trim();
    if (primero) await mandar(primero, r.datos);
  };

  const mandar = async (cuerpo: string, s: Sesion | null = sesion) => {
    if (!s || !cuerpo.trim()) return;
    setOcupado(true);
    setError('');
    const r = await enviarChat(clave, s.token, cuerpo);
    setOcupado(false);
    if (r.ok) {
      anadir([r.datos]);
      setTexto('');
    } else if (r.caducado) {
      caducar();
      setError(r.error);
    } else setError(r.error);
  };

  const color = /^#[0-9a-f]{6}$/i.test(config.color) ? config.color : '#155eef';
  const campo = 'h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm text-[#101828] placeholder:text-[#98a2b3] focus:border-[var(--c)] focus:outline-none focus:ring-2 focus:ring-[var(--c)]/20';

  return (
    <main className="flex h-dvh flex-col bg-white font-sans text-[#101828]" style={{ '--c': color } as React.CSSProperties}>
      <header className="flex shrink-0 items-start gap-3 px-5 py-4 text-white" style={{ background: color }}>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{config.titulo}</h1>
          {config.subtitulo && <p className="mt-0.5 text-[13px] leading-5 text-white/85">{config.subtitulo}</p>}
        </div>
        {enMarco && (
          <button type="button" aria-label="Cerrar el chat" onClick={() => window.parent.postMessage('chat-web:cerrar', '*')}
            className="rounded-full p-1.5 text-white/90 hover:bg-white/15">
            <X className="size-5" />
          </button>
        )}
      </header>

      <div ref={fondo} className="flex-1 space-y-3 overflow-y-auto bg-[#f9fafb] px-4 py-4" aria-live="polite">
        {config.saludo && (
          <Burbuja lado="izq" color={color} autor={config.empresa}>{config.saludo}</Burbuja>
        )}
        {mensajes.map((m) => (
          <Burbuja key={m.id} lado={m.direccion === 'entrante' ? 'der' : 'izq'} color={color}
            autor={m.direccion === 'saliente' ? m.autor ?? config.empresa : undefined} pie={hora(m.creado)}>
            {m.cuerpo}
          </Burbuja>
        ))}
        {listo && !sesion && (
          <form onSubmit={empezar} className="space-y-2.5 rounded-xl border border-[#eaecf0] bg-white p-4 shadow-sm">
            <p className="text-sm font-medium">Déjanos tus datos para poder responderte</p>
            <input name="nombre" required maxLength={100} autoComplete="name" placeholder="Nombre" aria-label="Nombre" className={campo} />
            <input name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Correo electrónico" aria-label="Correo electrónico" className={campo} />
            <input name="telefono" type="tel" required={config.pedir_telefono} maxLength={30} autoComplete="tel"
              placeholder={config.pedir_telefono ? 'Teléfono' : 'Teléfono (opcional)'} aria-label="Teléfono" className={campo} />
            <textarea name="mensaje" rows={3} maxLength={2000} placeholder="¿En qué podemos ayudarte?" aria-label="Mensaje"
              className={`${campo} h-auto resize-none py-2`} />
            {config.aviso_legal && <p className="text-[11px] leading-4 text-[#667085]">{config.aviso_legal}</p>}
            <button disabled={ocupado} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: color }}>
              {ocupado && <Loader2 className="size-4 animate-spin" />} Empezar a chatear
            </button>
          </form>
        )}
      </div>

      {error && <p role="alert" className="shrink-0 bg-[#fef3f2] px-4 py-2 text-[13px] text-[#b42318]">{error}</p>}

      {sesion && (
        <form className="flex shrink-0 items-end gap-2 border-t border-[#eaecf0] bg-white p-3"
          onSubmit={(e) => { e.preventDefault(); void mandar(texto); }}>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void mandar(texto); } }}
            placeholder="Escribe un mensaje…" aria-label="Mensaje"
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-sm leading-5 focus:border-[var(--c)] focus:outline-none" />
          <button disabled={ocupado || !texto.trim()} aria-label="Enviar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ background: color }}>
            {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      )}
    </main>
  );
}

function Burbuja({ lado, color, autor, pie, children }: { lado: 'izq' | 'der'; color: string; autor?: string; pie?: string; children: React.ReactNode }) {
  const der = lado === 'der';
  return (
    <div className={`flex flex-col ${der ? 'items-end' : 'items-start'}`}>
      {autor && <span className="mb-1 px-1 text-[11px] font-medium text-[#667085]">{autor}</span>}
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-5 [overflow-wrap:anywhere] ${der ? 'rounded-br-md text-white' : 'rounded-bl-md border border-[#eaecf0] bg-white'}`}
        style={der ? { background: color } : undefined}>
        {children}
      </div>
      {pie && <span className="mt-1 px-1 text-[11px] text-[#98a2b3]">{pie}</span>}
    </div>
  );
}
