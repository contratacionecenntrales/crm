'use client';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ChevronUp, ExternalLink, Plus, X } from 'lucide-react';
import { cambiarDnd, cambiarEtiquetas, cambiarPropietario } from '@/app/subcuenta/[id]/contactos/acciones';
import { nombreContacto, type Contacto, type Usuario } from '@/lib/crm/tipos';
import { AvatarContacto } from './Bandeja';

const CANALES_DND = [['email', 'Correos electrónicos'], ['sms', 'Mensajes de texto'], ['llamada', 'Llamadas'], ['whatsapp', 'WhatsApp']] as const;

export function PanelContacto({ subId, contacto: c, asignables, etiquetas, alCerrar }: {
  subId: string; contacto: Contacto; asignables: Usuario[]; etiquetas: string[]; alCerrar: () => void;
}) {
  const [pestana, setPestana] = useState<'campos' | 'dnd'>('campos');
  const [abierto, setAbierto] = useState(true);
  const [tags, setTags] = useState(c.etiquetas);
  const [nueva, setNueva] = useState('');
  const [dnd, setDnd] = useState(c.dnd);
  const [dndCanales, setDndCanales] = useState(c.dnd_canales);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  useEffect(() => { setTags(c.etiquetas); setDnd(c.dnd); setDndCanales(c.dnd_canales); }, [c]);

  const hacer = (fn: () => Promise<{ ok: boolean; error?: string }>, deshacer: () => void) => iniciar(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) { deshacer(); setError(r.error ?? 'No se pudo guardar.'); }
  });
  const ponerTags = (lista: string[]) => {
    const antes = tags;
    setTags(lista);
    hacer(() => cambiarEtiquetas(subId, c.id, lista), () => setTags(antes));
  };
  const ponerDnd = (todo: boolean, canales: string[]) => {
    const antes = [dnd, dndCanales] as const;
    setDnd(todo); setDndCanales(canales);
    hacer(() => cambiarDnd(subId, c.id, todo, canales), () => { setDnd(antes[0]); setDndCanales(antes[1]); });
  };

  const campos: [string, string][] = [
    ['Nombre', c.nombre], ['Apellidos', c.apellidos], ['Correo electrónico', c.email ?? ''], ['Teléfono', c.telefono],
    ['Fuente de contacto', c.fuente], ['Tipo de contacto', c.tipo === 'cliente' ? 'Cliente' : 'Lead'],
    ['Nombre de la empresa', c.empresa?.nombre ?? ''], ['Dirección postal', [c.direccion, c.codigo_postal, c.ciudad, c.provincia].filter(Boolean).join(', ')],
    ['Sitio web', c.web],
  ];

  return (
    <aside className={`hidden w-[300px] shrink-0 flex-col overflow-y-auto rounded-lg bg-superficie p-4 font-sans xl:flex ${pendiente ? 'opacity-80' : ''}`} aria-label="Detalles de contacto">
      <div className="mb-2 flex h-8 items-center justify-between">
        <p className="text-sm font-medium text-[#101828] dark:text-texto">Detalles de Contacto</p>
        <button type="button" onClick={alCerrar} aria-label="Cerrar detalles" className="rounded p-1 text-[#475467] hover:bg-superficie-2"><X className="size-4" /></button>
      </div>
      <div className="space-y-4 rounded-lg border border-borde p-3">
        <div className="flex items-center gap-3">
          <AvatarContacto c={c} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#101828] dark:text-texto">{nombreContacto(c)}</span>
          <Link href={`/subcuenta/${subId}/contacto/${c.id}`} title="Ver detalles de contacto" aria-label="Ver detalles de contacto" className="text-[#475467] hover:text-primario">
            <ExternalLink className="size-4" />
          </Link>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[#475467] dark:text-texto-2">Propietario</span>
          <select value={c.propietario_id ?? ''} onChange={(e) => hacer(() => cambiarPropietario(subId, c.id, e.target.value || null), () => {})}
            className="h-8 w-full rounded-full border border-borde-fuerte bg-superficie px-3 text-sm text-texto">
            <option value="">Sin asignar</option>
            {asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-[#475467] dark:text-texto-2">Etiquetas ({tags.length})</span>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#f2f4f7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                <span className="truncate">{t}</span>
                <button type="button" aria-label={`Quitar ${t}`} onClick={() => ponerTags(tags.filter((x) => x !== t))} className="hover:text-peligro"><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <form className="mt-2 flex gap-1" onSubmit={(e) => {
            e.preventDefault();
            const n = nueva.trim().slice(0, 60);
            if (n && !tags.includes(n)) ponerTags([...tags, n]);
            setNueva('');
          }}>
            <input list={`etiquetas-${c.id}`} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Añadir etiqueta" maxLength={60}
              className="h-8 min-w-0 flex-1 rounded border border-borde-fuerte bg-superficie px-2 text-sm text-texto focus:border-primario focus:outline-none" />
            <datalist id={`etiquetas-${c.id}`}>{etiquetas.filter((e) => !tags.includes(e)).map((e) => <option key={e} value={e} />)}</datalist>
            <button aria-label="Añadir etiqueta" className="rounded border border-borde-fuerte px-2 text-[#475467] hover:bg-superficie-2"><Plus className="size-4" /></button>
          </form>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-peligro">{error}</p>}

      <div className="mt-4 flex rounded border border-borde text-[13px] font-medium">
        {([['campos', 'Todos los campos'], ['dnd', 'DND']] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => setPestana(v)}
            className={`flex-1 px-2 py-1 ${pestana === v ? 'bg-superficie-2 text-[#101828] dark:text-texto' : 'text-[#475467]'}`}>{t}</button>
        ))}
      </div>

      {pestana === 'campos' ? (
        <div className="mt-3 overflow-hidden rounded-md border border-borde">
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
            className="flex w-full items-center justify-between bg-[#f2f4f7] px-4 py-3 text-sm font-medium text-[#101828] dark:bg-superficie-2 dark:text-texto">
            Contacto <ChevronUp className={`size-4 transition ${abierto ? '' : 'rotate-180'}`} />
          </button>
          {abierto && (
            <dl className="space-y-4 px-4 py-4">
              {campos.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-[#667085]">{k}</dt>
                  <dd className="break-words text-sm font-medium text-[#101828] dark:text-texto">{v || '--'}</dd>
                </div>
              ))}
              <Link href={`/subcuenta/${subId}/contacto/${c.id}`} className="block text-sm font-medium text-primario-texto hover:underline">Editar en la ficha del contacto</Link>
            </dl>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-md border border-borde p-4 text-sm text-[#344054] dark:text-texto-2">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={dnd} onChange={(e) => ponerDnd(e.target.checked, dndCanales)} className="size-4" />
            No molestar en ningún canal
          </label>
          <p className="text-xs text-tenue">O solo en algunos:</p>
          {CANALES_DND.map(([v, t]) => (
            <label key={v} className="flex items-center gap-2">
              <input type="checkbox" disabled={dnd} checked={dnd || dndCanales.includes(v)} className="size-4"
                onChange={(e) => ponerDnd(false, e.target.checked ? [...dndCanales, v] : dndCanales.filter((x) => x !== v))} />
              {t}
            </label>
          ))}
        </div>
      )}
    </aside>
  );
}
