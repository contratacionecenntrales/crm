'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { MessageSquareQuote, Send, Settings2, Star } from 'lucide-react';
import { buscarContactosResena, guardarAjustesResena, pedirResenaPanel, type AjustesResena } from '@/app/subcuenta/[id]/reputacion/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

export interface FilaResena {
  id: string; canal: 'email' | 'sms' | 'whatsapp'; estado: 'enviada' | 'abierta' | 'valorada'; puntuacion: number | null; comentario: string;
  creado: string; valorada_en: string | null; contacto: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string } | null;
}

export const Estrellas = ({ n, tam = 'size-4' }: { n: number; tam?: string }) => (
  <span className="inline-flex" aria-label={`${n} de 5 estrellas`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${tam} ${i <= n ? 'fill-[#fdb022] text-[#fdb022]' : 'text-[#d0d5dd]'}`} />)}</span>
);

export function PanelReputacion({ subId, ajustes, solicitudes, soyAdmin }: { subId: string; ajustes: AjustesResena; solicitudes: FilaResena[]; soyAdmin: boolean }) {
  const [pedir, setPedir] = useState(false);
  const [config, setConfig] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'buenas' | 'malas' | 'pendientes'>('todas');
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const valoradas = solicitudes.filter((s) => s.puntuacion);
  const media = valoradas.length ? valoradas.reduce((t, s) => t + s.puntuacion!, 0) / valoradas.length : 0;
  const buenas = valoradas.filter((s) => s.puntuacion! >= ajustes.umbral).length;
  const lista = solicitudes.filter((s) => filtro === 'todas' || (filtro === 'pendientes' ? !s.puntuacion : s.puntuacion && (filtro === 'buenas') === (s.puntuacion >= ajustes.umbral)));
  const reparto = [5, 4, 3, 2, 1].map((n) => [n, valoradas.filter((s) => s.puntuacion === n).length] as const);

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Reputación</h1>
          <p className="text-xs text-tenue">Pide reseñas a tus clientes. Las valoraciones buenas van a tu ficha de Google; las malas te llegan a ti en privado.</p>
        </div>
        <div className="flex gap-2">
          {soyAdmin && <button onClick={() => setConfig(true)} className={estilosBoton.secundario}><Settings2 className="size-4" /> Ajustes</button>}
          <button onClick={() => { setPedir(true); setAviso(null); }} className={estilosBoton.primario}><Send className="size-4" /> Pedir reseña</button>
        </div>
      </div>
      {!ajustes.enlace_resena && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Añade en Ajustes el enlace de tu ficha de Google para enviar allí a los clientes contentos.</p>}
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 rounded-lg border border-borde bg-superficie p-4 lg:col-span-1">
          <p className="text-xs text-tenue">Valoración media</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-texto">{valoradas.length ? media.toFixed(1) : '—'}<Estrellas n={Math.round(media)} /></p>
        </div>
        {[['Solicitudes', solicitudes.length], ['Valoradas', `${valoradas.length}${solicitudes.length ? ` (${Math.round((valoradas.length / solicitudes.length) * 100)} %)` : ''}`], ['A Google', buenas], ['En privado', valoradas.length - buenas]].map(([t, v]) => (
          <div key={t as string} className="min-w-0 rounded-lg border border-borde bg-superficie p-4"><p className="text-xs text-tenue">{t}</p><p className="mt-1 text-2xl font-semibold text-texto">{v}</p></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 rounded-lg border border-borde bg-superficie">
          <div className="flex flex-wrap gap-1 border-b border-borde p-2" role="tablist">
            {([['todas', 'Todas'], ['buenas', 'Buenas'], ['malas', 'A mejorar'], ['pendientes', 'Sin valorar']] as const).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={`rounded-md px-3 py-1.5 text-sm ${filtro === k ? 'bg-primario-suave font-medium text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>{t}</button>
            ))}
          </div>
          {lista.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center"><MessageSquareQuote className="size-9 text-tenue" /><p className="mt-2 text-sm text-tenue">No hay nada aquí todavía.</p></div>
          ) : (
            <ul className="divide-y divide-borde">
              {lista.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={s.contacto ? `/subcuenta/${subId}/contacto/${s.contacto.id}` : '#'} className="font-medium text-texto hover:underline">
                      {s.contacto ? `${s.contacto.nombre} ${s.contacto.apellidos}`.trim() || s.contacto.email || s.contacto.telefono : 'Contacto borrado'}</a>
                    {s.puntuacion ? <Estrellas n={s.puntuacion} /> : <Insignia tono={s.estado === 'abierta' ? 'azul' : 'gris'}>{s.estado === 'abierta' ? 'Abierta, sin valorar' : 'Enviada'}</Insignia>}
                  </div>
                  {s.comentario && <p className="mt-1 whitespace-pre-line text-sm text-texto-2 [overflow-wrap:anywhere]">“{s.comentario}”</p>}
                  <p className="mt-1 text-xs text-tenue">Pedida por {s.canal === 'email' ? 'correo' : s.canal === 'sms' ? 'SMS' : 'WhatsApp'} el {fecha(s.creado)}{s.valorada_en ? ` · valorada el ${fecha(s.valorada_en)}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-borde bg-superficie p-4">
          <h2 className="mb-3 text-sm font-semibold text-texto">Reparto</h2>
          {reparto.map(([n, c]) => (
            <div key={n} className="mb-1.5 flex items-center gap-2 text-xs text-texto-2">
              <span className="w-3">{n}</span><Star className="size-3.5 fill-[#fdb022] text-[#fdb022]" />
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-2"><span className="block h-full rounded-full bg-[#fdb022]" style={{ width: `${valoradas.length ? (c / valoradas.length) * 100 : 0}%` }} /></span>
              <span className="w-6 text-right">{c}</span>
            </div>
          ))}
        </div>
      </div>
      <Modal abierto={pedir} alCerrar={() => setPedir(false)} titulo="Pedir reseña">
        {pedir && <FormPedir subId={subId} alTerminar={(r) => { setPedir(false); setAviso(r); }} />}
      </Modal>
      <Modal abierto={config} alCerrar={() => setConfig(false)} titulo="Ajustes de reputación">
        {config && <FormAjustes subId={subId} a={ajustes} alTerminar={(r) => { setConfig(false); setAviso(r); }} />}
      </Modal>
    </div>
  );
}

function FormPedir({ subId, alTerminar }: { subId: string; alTerminar: (r: Resultado) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<{ id: string; nombre: string; email: string | null; telefono: string }[]>([]);
  const [elegido, setElegido] = useState<string>('');
  const [canal, setCanal] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  useEffect(() => { let vivo = true; const t = setTimeout(async () => { const l = await buscarContactosResena(subId, q); if (vivo) setLista(l); }, 250); return () => { vivo = false; clearTimeout(t); }; }, [q, subId]);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!elegido) return setR({ ok: false, error: 'Elige un contacto.' });
      iniciar(async () => { const x = await pedirResenaPanel(subId, elegido, canal); if (x.ok) { router.refresh(); alTerminar(x); } else setR(x); }); }}>
      <label className="block"><span className="mb-1 block text-sm font-medium">Contacto</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre, correo o teléfono" className={estiloInput} /></label>
      <ul className="max-h-52 divide-y divide-borde overflow-y-auto rounded border border-borde" role="listbox" aria-label="Contactos">
        {lista.length === 0 && <li className="px-3 py-2 text-sm text-tenue">Sin resultados.</li>}
        {lista.map((c) => (
          <li key={c.id}><button type="button" role="option" aria-selected={elegido === c.id} onClick={() => setElegido(c.id)}
            className={`w-full px-3 py-2 text-left text-sm ${elegido === c.id ? 'bg-primario-suave text-primario-texto' : 'hover:bg-superficie-2'}`}>
            <span className="font-medium">{c.nombre}</span> <span className="text-xs text-tenue">{[c.email, c.telefono].filter(Boolean).join(' · ')}</span></button></li>
        ))}
      </ul>
      <label className="block"><span className="mb-1 block text-sm font-medium">Enviar por</span>
        <select value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)} className={estiloInput}>
          <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Correo</option>
        </select></label>
      <Aviso estado={r} />
      <div className="flex justify-end gap-2"><button disabled={pendiente} className={estilosBoton.primario}><Send className="size-4" /> {pendiente ? 'Enviando…' : 'Enviar solicitud'}</button></div>
    </form>
  );
}

function FormAjustes({ subId, a, alTerminar }: { subId: string; a: AjustesResena; alTerminar: (r: Resultado) => void }) {
  const router = useRouter();
  const [f, setF] = useState(a);
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await guardarAjustesResena(subId, f); if (x.ok) { router.refresh(); alTerminar(x); } else setR(x); }); }}>
      <label className="block"><span className="mb-1 block text-sm font-medium">Enlace de tu ficha de reseñas (Google, Trustpilot…)</span>
        <input value={f.enlace_resena} onChange={(e) => setF({ ...f, enlace_resena: e.target.value })} placeholder="https://g.page/r/…/review" className={estiloInput} /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Se envía a la web de reseñas a partir de</span>
        <select value={f.umbral} onChange={(e) => setF({ ...f, umbral: Number(e.target.value) })} className={estiloInput}>
          {[5, 4, 3].map((n) => <option key={n} value={n}>{n} estrellas</option>)}
        </select></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Mensaje (SMS, WhatsApp y cuerpo del correo)</span>
        <textarea value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} rows={4} maxLength={1000} className={estiloArea} />
        <span className="text-xs text-tenue">Usa {'{{contacto.nombre}}'}, {'{{empresa.nombre}}'} y {'{{enlace}}'} (el enlace de valoración).</span></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Asunto del correo</span>
        <input value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} maxLength={300} className={estiloInput} /></label>
      <Aviso estado={r} />
      <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.primario}>Guardar</button></div>
    </form>
  );
}
