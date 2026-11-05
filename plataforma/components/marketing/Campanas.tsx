'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Copy, Mail, Megaphone, MessageCircle, MessageSquare, Pencil, Plus, Send, Trash2, XCircle } from 'lucide-react';
import { audienciaCampana, borrarCampana, cancelarCampana, duplicarCampana, guardarCampana, lanzarCampana, type DatosCampana } from '@/app/subcuenta/[id]/marketing/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { VARIABLES } from '@/lib/automatizacion/tipos';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

interface Stats { total: number; enviados: number; fallidos: number; omitidos: number; pendientes: number; bajas: number }
export interface FilaCampana extends DatosCampana {
  id: string; estado: 'borrador' | 'programada' | 'enviando' | 'enviada' | 'cancelada';
  programada_en: string | null; lanzada_en: string | null; terminada_en: string | null; creado: string; stats: Stats | null;
}
const CANAL = { email: ['Correo', Mail], sms: ['SMS', MessageSquare], whatsapp: ['WhatsApp', MessageCircle] } as const;
const ESTADO = { borrador: ['Borrador', 'gris'], programada: ['Programada', 'azul'], enviando: ['Enviando', 'azul'], enviada: ['Enviada', 'verde'], cancelada: ['Cancelada', 'rojo'] } as const;
const VACIA: DatosCampana = { nombre: 'Nueva campaña', canal: 'email', asunto: '', cuerpo: 'Hola {{contacto.nombre}},\n\n', etiquetas: [], modo: 'alguna', excluir: [] };

export function Campanas({ subId, campanas, etiquetas, soyAdmin }: { subId: string; campanas: FilaCampana[]; etiquetas: string[]; soyAdmin: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<FilaCampana | 'nueva' | null>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const hacer = (f: () => Promise<Resultado>) => iniciar(async () => { const r = await f(); setAviso(r); if (r.ok) router.refresh(); });
  const enCurso = campanas.some((c) => c.estado === 'enviando' || c.estado === 'programada');
  useEffect(() => { if (!enCurso) return; const t = setInterval(() => router.refresh(), 15000); return () => clearInterval(t); }, [enCurso, router]);

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Marketing</h1>
          <p className="text-xs text-tenue">Campañas de correo, SMS o WhatsApp a tus contactos por etiquetas. Respetan «No molestar» y llevan opción de baja.</p>
        </div>
        {soyAdmin && <button onClick={() => { setEditando('nueva'); setAviso(null); }} className={estilosBoton.primario}><Plus className="size-4" /> Nueva campaña</button>}
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      {campanas.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie px-6 py-16 text-center">
          <Megaphone className="size-10 text-tenue" />
          <p className="mt-3 font-medium text-texto">Aún no hay campañas</p>
          <p className="mt-1 text-sm text-tenue">Envía una promoción, un boletín o un recordatorio a un grupo de contactos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Campaña</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Destinatarios</th><th className="px-3 py-2.5">Enviados</th><th className="px-3 py-2.5">Fallidos</th><th className="px-3 py-2.5">Bajas</th><th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {campanas.map((c) => {
                const [canal, Ic] = CANAL[c.canal];
                const [txt, tono] = ESTADO[c.estado];
                const s = c.stats;
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><p className="flex items-center gap-1.5 font-medium text-texto"><Ic className="size-4 text-tenue" />{c.nombre}</p>
                      <p className="text-xs text-tenue">{canal} · {c.etiquetas.length ? `${c.modo === 'todas' ? 'Con todas' : 'Con alguna'}: ${c.etiquetas.join(', ')}` : 'Todos los contactos'}{c.excluir.length ? ` · sin ${c.excluir.join(', ')}` : ''}</p></td>
                    <td className="px-3 py-3"><Insignia tono={tono}>{txt}</Insignia>{c.estado === 'enviando' && s && <p className="mt-1 text-xs text-tenue">{s.pendientes} en cola</p>}</td>
                    <td className="px-3 py-3 text-texto-2">{s?.total ?? '—'}</td>
                    <td className="px-3 py-3 text-texto-2">{s ? `${s.enviados}${s.total ? ` (${Math.round((s.enviados / s.total) * 100)} %)` : ''}` : '—'}</td>
                    <td className="px-3 py-3 text-texto-2">{s?.fallidos ?? '—'}</td>
                    <td className="px-3 py-3 text-texto-2">{s?.bajas ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-texto-2">{c.estado === 'programada' ? `Sale ${fecha(c.programada_en)} ${new Date(c.programada_en!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : fecha(c.lanzada_en ?? c.creado)}</td>
                    <td className="px-3 py-3 text-right">
                      {soyAdmin && (
                        <span className="inline-flex gap-0.5">
                          {c.estado === 'borrador' && <button onClick={() => { setEditando(c); setAviso(null); }} aria-label={`Editar ${c.nombre}`} title="Editar y enviar" className="rounded p-1.5 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>}
                          {(c.estado === 'enviando' || c.estado === 'programada') && <button disabled={pendiente} onClick={() => confirm(`¿Cancelar «${c.nombre}»? Lo que ya salió no se puede deshacer.`) && hacer(() => cancelarCampana(subId, c.id))} aria-label={`Cancelar ${c.nombre}`} title="Cancelar" className="rounded p-1.5 text-texto-2 hover:text-peligro"><XCircle className="size-4" /></button>}
                          <button disabled={pendiente} onClick={() => hacer(() => duplicarCampana(subId, c.id))} aria-label={`Duplicar ${c.nombre}`} title="Duplicar" className="rounded p-1.5 text-texto-2 hover:text-texto"><Copy className="size-4" /></button>
                          {c.estado !== 'enviando' && c.estado !== 'programada' && <button disabled={pendiente} onClick={() => confirm(`¿Borrar «${c.nombre}» y sus estadísticas?`) && hacer(() => borrarCampana(subId, c.id))} aria-label={`Borrar ${c.nombre}`} title="Borrar" className="rounded p-1.5 text-texto-2 hover:text-peligro"><Trash2 className="size-4" /></button>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal abierto={editando !== null} alCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva campaña' : 'Editar campaña'} ancho="max-w-2xl">
        {editando !== null && <Editor subId={subId} c={editando === 'nueva' ? null : editando} etiquetas={etiquetas}
          alTerminar={(r) => { setEditando(null); if (r) setAviso(r); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

function Chips({ titulo, todas, v, on }: { titulo: string; todas: string[]; v: string[]; on: (x: string[]) => void }) {
  return (
    <div><span className="mb-1 block text-sm font-medium">{titulo}</span>
      {todas.length === 0 ? <p className="text-xs text-tenue">Aún no hay etiquetas en tus contactos.</p> : (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {todas.map((t) => (
            <button key={t} type="button" aria-pressed={v.includes(t)} onClick={() => on(v.includes(t) ? v.filter((x) => x !== t) : [...v, t].slice(0, 20))}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${v.includes(t) ? 'border-primario bg-primario-suave text-primario-texto' : 'border-borde-fuerte text-texto-2'}`}>{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({ subId, c, etiquetas, alTerminar }: { subId: string; c: FilaCampana | null; etiquetas: string[]; alTerminar: (r?: Resultado) => void }) {
  const [f, setF] = useState<DatosCampana>(c ? { nombre: c.nombre, canal: c.canal, asunto: c.asunto, cuerpo: c.cuerpo, etiquetas: c.etiquetas, modo: c.modo, excluir: c.excluir } : VACIA);
  const [id, setId] = useState<string | null>(c?.id ?? null);
  const [audiencia, setAudiencia] = useState<number | null>(null);
  const [cuando, setCuando] = useState('');
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = <K extends keyof DatosCampana>(k: K, v: DatosCampana[K]) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => { const n = await audienciaCampana(subId, f); if (vivo) setAudiencia(n); }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [subId, f.canal, f.etiquetas, f.modo, f.excluir]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => { const x = await guardarCampana(subId, id, f); if (x.ok && x.id) setId(x.id); return x; };
  const lanzar = (programar: boolean) => iniciar(async () => {
    if (programar && !cuando) { setR({ ok: false, error: 'Elige la fecha y hora de envío.' }); return; }
    if (!confirm(programar ? `¿Programar la campaña para ${audiencia ?? '?'} contacto(s)?` : `¿Enviar ahora a ${audiencia ?? '?'} contacto(s)? No se puede deshacer.`)) return;
    const g = await guardar();
    if (!g.ok || !g.id) { setR(g); return; }
    const l = await lanzarCampana(subId, g.id, programar ? new Date(cuando).toISOString() : null);
    if (l.ok) alTerminar(l); else setR(l);
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await guardar(); setR(x); if (x.ok) alTerminar(x); }); }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block min-w-0"><span className="mb-1 block text-sm font-medium">Nombre (interno)</span><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={120} required className={estiloInput} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Canal</span>
          <select value={f.canal} onChange={(e) => set('canal', e.target.value as DatosCampana['canal'])} className={estiloInput}>
            <option value="email">Correo</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
          </select></label>
      </div>
      {f.canal === 'email' && <label className="block"><span className="mb-1 block text-sm font-medium">Asunto</span><input value={f.asunto} onChange={(e) => set('asunto', e.target.value)} maxLength={300} className={estiloInput} /></label>}
      <label className="block"><span className="mb-1 block text-sm font-medium">Mensaje</span>
        <textarea value={f.cuerpo} onChange={(e) => set('cuerpo', e.target.value)} rows={f.canal === 'email' ? 9 : 5} maxLength={f.canal === 'sms' ? 1400 : 20000} className={estiloArea} /></label>
      <div className="flex flex-wrap gap-1">
        {VARIABLES.slice(0, 6).map(([k, t]) => <button key={k} type="button" onClick={() => set('cuerpo', `${f.cuerpo}{{${k}}}`)} className="rounded-full border border-borde-fuerte px-2 py-0.5 text-[11px] text-texto-2 hover:border-primario">{t}</button>)}
      </div>
      <p className="text-xs text-tenue">{f.canal === 'email' ? 'Se añade al final un enlace para darse de baja.' : 'Se añade al final «Responde BAJA para no recibir más mensajes».'}</p>
      <fieldset className="min-w-0 space-y-3 rounded-lg border border-borde p-3">
        <legend className="px-1 text-sm font-medium">Destinatarios</legend>
        <Chips titulo="Contactos con la etiqueta (vacío = todos)" todas={etiquetas} v={f.etiquetas} on={(x) => set('etiquetas', x)} />
        {f.etiquetas.length > 1 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.modo === 'todas'} onChange={(e) => set('modo', e.target.checked ? 'todas' : 'alguna')} className="size-4" /> Solo los que tienen todas</label>}
        <Chips titulo="Excluir a quien tenga" todas={etiquetas} v={f.excluir} on={(x) => set('excluir', x)} />
        <p className="text-sm font-medium text-texto"><Send className="mr-1 inline size-4 text-primario" />Llegará a {audiencia ?? '…'} contacto(s) <span className="font-normal text-tenue">(con {f.canal === 'email' ? 'correo' : 'teléfono'} y sin «No molestar»)</span></p>
      </fieldset>
      <Aviso estado={r} />
      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-borde pt-4">
        <button disabled={pendiente} className={estilosBoton.secundario}>Guardar borrador</button>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="mb-1 block text-xs text-tenue">Programar para</span>
            <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} className={estiloInput} /></label>
          <button type="button" disabled={pendiente || !audiencia} onClick={() => lanzar(true)} className={estilosBoton.secundario}>Programar</button>
          <button type="button" disabled={pendiente || !audiencia} onClick={() => lanzar(false)} className={estilosBoton.primario}><Send className="size-4" /> Enviar ahora</button>
        </div>
      </div>
    </form>
  );
}
