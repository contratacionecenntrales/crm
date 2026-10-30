'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, User, Zap } from 'lucide-react';
import { buscarContactos } from '@/app/subcuenta/[id]/contactos/acciones';
import { useFueraDe } from './useFueraDe';
import { useMenuExpandido } from './MarcoPanel';
import { nombreContacto } from '@/lib/crm/tipos';
import type { ElementoNav } from './iconos';

type Resultado = { tipo: 'pagina' | 'contacto' | 'cuenta'; texto: string; detalle?: string; href: string };

// Buscador global (Ctrl/Cmd + K): pantallas, contactos de la subcuenta o
// subcuentas de la agencia.
export function Buscador({ subId, paginas, cuentas }: { subId?: string; paginas: ElementoNav[]; cuentas?: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const expandido = useMenuExpandido();
  const [q, setQ] = useState('');
  const [contactos, setContactos] = useState<Resultado[]>([]);
  const [i, setI] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  useEffect(() => {
    if (!abierto || !subId || q.trim().length < 2) return setContactos([]);
    const t = setTimeout(async () => {
      const r = await buscarContactos(subId, q);
      setContactos(r.map((c) => ({ tipo: 'contacto', texto: nombreContacto(c), detalle: c.email ?? c.telefono, href: `/subcuenta/${subId}/contacto/${c.id}` })));
    }, 250);
    return () => clearTimeout(t);
  }, [q, abierto, subId]);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pags: Resultado[] = paginas.filter((p) => !t || p.etiqueta.toLowerCase().includes(t)).map((p) => ({ tipo: 'pagina', texto: p.etiqueta, href: p.href }));
    const cts: Resultado[] = (cuentas ?? []).filter((c) => t && c.nombre.toLowerCase().includes(t)).slice(0, 8)
      .map((c) => ({ tipo: 'cuenta', texto: c.nombre, detalle: 'Subcuenta', href: `/subcuenta/${c.id}` }));
    return [...pags, ...cts, ...contactos];
  }, [q, paginas, cuentas, contactos]);
  useEffect(() => setI(0), [q]);

  const ir = (r: Resultado) => {
    setAbierto(false);
    setQ('');
    router.push(r.href);
  };

  return (
    <>
      {expandido ? (
        <button onClick={() => setAbierto(true)} aria-label="Buscar (Ctrl + K)"
          className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[5px] px-1 text-sm text-[var(--menu)] hover:bg-[var(--hover-menu)]">
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded bg-gray-200 px-1 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">ctrlK</kbd>
        </button>
      ) : (
        <button onClick={() => setAbierto(true)} aria-label="Buscar (Ctrl + K)" title="Buscar (Ctrl + K)"
          className="flex h-[22px] w-[42px] items-center justify-center rounded-[5px] bg-[var(--hover-menu)] px-2 py-0.5 text-[var(--menu)]">
          <Search className="size-4" />
        </button>
      )}
      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-4 pt-[12vh] font-sans" onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-lg border bg-superficie shadow-2xl">
            <label className="flex items-center gap-2 border-b px-4">
              <Search className="size-4 text-tenue" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={subId ? 'Buscar contactos o pantallas…' : 'Buscar subcuentas o pantallas…'}
                className="h-12 flex-1 bg-transparent text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, resultados.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
                  if (e.key === 'Enter' && resultados[i]) ir(resultados[i]);
                }} />
              <kbd className="rounded border px-1.5 text-xs text-tenue">Esc</kbd>
            </label>
            <ul className="max-h-80 overflow-y-auto py-1">
              {resultados.length === 0 && <li className="px-4 py-6 text-center text-sm text-tenue">Sin resultados</li>}
              {resultados.map((r, j) => (
                <li key={r.tipo + r.href}>
                  <button onMouseEnter={() => setI(j)} onClick={() => ir(r)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${j === i ? 'bg-primario-suave' : ''}`}>
                    {r.tipo === 'pagina' ? <ArrowRight className="size-4 text-tenue" /> : <User className="size-4 text-tenue" />}
                    <span className="flex-1 truncate">{r.texto}</span>
                    {r.detalle && <span className="truncate text-xs text-tenue">{r.detalle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export function AccionesRapidas({ subId }: { subId: string }) {
  const [abierto, setAbierto] = useState(false);
  const expandido = useMenuExpandido();
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState(0);
  useFueraDe(caja, abierto, () => setAbierto(false));
  const base = `/subcuenta/${subId}`;
  const acciones = [
    ['Añadir contacto', `${base}/contactos?nuevo=1`],
    ['Reservar cita', `${base}/calendarios?nuevo=1`],
    ['Enviar mensaje', `${base}/conversaciones?nuevo=1`],
    ['Importar contactos', `${base}/contactos?importar=1`],
    ['Añadir oportunidad', `${base}/oportunidades?nueva=1`],
    ['Añadir tarea', `${base}/contactos/tareas?nueva=1`],
  ];
  const router = useRouter();
  return (
    <div ref={caja}>
      <button ref={boton} aria-label="Acciones rápidas" title="Acciones rápidas" aria-expanded={abierto}
        onClick={() => { setTop(boton.current?.getBoundingClientRect().top ?? 0); setAbierto((v) => !v); }}
        className={expandido ? 'flex size-7 items-center justify-center rounded-[5px] hover:bg-[var(--hover-menu)]' : 'flex h-3.5 w-9 items-center justify-center rounded-[5px] bg-[var(--hover-menu)]'}>
        <Zap className="size-3 fill-[#22c55e] text-[#22c55e]" />
      </button>
      {abierto && (
        <div style={{ top: top - 8, left: expandido ? 244 : 60 }} className="fixed z-50 w-60 rounded-md border bg-superficie p-1 font-sans shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-tenue">Acciones rápidas</p>
          {acciones.map(([t, href]) => (
            <button key={t} onClick={() => { setAbierto(false); router.push(href); }} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-superficie-2">{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}
