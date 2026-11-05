'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle, Bot, FileUp, Lock, Plus, RotateCcw, Send, Trash2, UserRound } from 'lucide-react';
import { borrarAsistente, guardarAsistente, probarAsistente, type DatosAsistente } from '@/app/subcuenta/[id]/ia/acciones';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { PLANTILLAS_ASISTENTE } from '@/lib/ia/plantillas';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

export interface FilaAsistente extends DatosAsistente { id: string; actualizado: string }
type Canal = DatosAsistente['canales'][number];
const CANALES: [Canal, string][] = [['chat', 'Chat web'], ['whatsapp', 'WhatsApp'], ['sms', 'SMS'], ['email', 'Correo']];
const VACIO: DatosAsistente = { nombre: 'Asistente', instrucciones: PLANTILLAS_ASISTENTE[0].instrucciones, conocimiento: '', canales: ['chat'], activo: false, max_respuestas: 30, traspaso_palabras: ['persona', 'humano', 'queja'], mensaje_traspaso: 'Te paso con una persona del equipo, en breve te contesta.' };

export function GestorAsistentes({ subId, asistentes, soyAdmin, planIncluye, configurada, uso, actividad }: {
  subId: string; asistentes: FilaAsistente[]; soyAdmin: boolean; planIncluye: boolean; configurada: boolean;
  uso: { hoy: number; mes: number; tokens: number }; actividad: { estado: string; detalle: string; creado: string }[];
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<string | 'nuevo' | null>(asistentes[0]?.id ?? null);
  const [f, setF] = useState<DatosAsistente>(asistentes[0] ?? VACIO);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (elegido === 'nuevo' || elegido === null) return;
    const a = asistentes.find((x) => x.id === elegido);
    if (a) setF({ nombre: a.nombre, instrucciones: a.instrucciones, conocimiento: a.conocimiento, canales: a.canales, activo: a.activo, max_respuestas: a.max_respuestas, traspaso_palabras: a.traspaso_palabras, mensaje_traspaso: a.mensaje_traspaso });
  }, [elegido, asistentes]);

  if (!planIncluye) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center font-sans">
      <Lock className="mx-auto size-10 text-tenue" />
      <h1 className="mt-4 text-xl font-semibold text-texto">Tu plan no incluye asistentes con IA</h1>
      <p className="mt-2 text-sm text-tenue">Pide a tu agencia que active «IA» en su plan.</p>
    </div>
  );

  const guardar = () => iniciar(async () => {
    const r = await guardarAsistente(subId, elegido === 'nuevo' ? null : elegido, f);
    setAviso(r);
    if (r.ok && r.id) { setElegido(r.id); router.refresh(); }
  });
  const set = <K extends keyof DatosAsistente>(k: K, v: DatosAsistente[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Asistentes IA</h1>
          <p className="text-xs text-tenue">Contestan solos en Conversaciones (chat web, WhatsApp, SMS y correo) con tus instrucciones y tu información. Cuando una persona responde, el asistente se pausa en esa conversación.</p>
        </div>
        {soyAdmin && <button onClick={() => { setElegido('nuevo'); setF(VACIO); setAviso(null); }} className={estilosBoton.primario}><Plus className="size-4" /> Nuevo asistente</button>}
      </div>
      {!configurada && <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> La IA aún no está conectada en el servidor de la plataforma (falta ANTHROPIC_API_KEY). Puedes preparar los asistentes; empezarán a contestar en cuanto se conecte.</p>}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[['Respuestas hoy', `${uso.hoy} / 500`], ['Respuestas (30 días)', uso.mes], ['Tokens (30 días)', uso.tokens.toLocaleString('es-ES')]].map(([t, v]) => (
          <div key={t as string} className="rounded-lg border border-borde bg-superficie p-3"><p className="text-xs text-tenue">{t}</p><p className="mt-1 text-xl font-semibold text-texto">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_360px]">
        <nav className="rounded-lg border border-borde bg-superficie p-2" aria-label="Asistentes">
          {asistentes.length === 0 && elegido !== 'nuevo' && <p className="p-3 text-sm text-tenue">Aún no hay asistentes.</p>}
          {asistentes.map((a) => (
            <button key={a.id} onClick={() => { setElegido(a.id); setAviso(null); }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${elegido === a.id ? 'bg-primario-suave text-primario-texto' : 'hover:bg-superficie-2'}`}>
              <Bot className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
              <Insignia tono={a.activo ? 'verde' : 'gris'}>{a.activo ? 'Activo' : 'Apagado'}</Insignia>
            </button>
          ))}
          {elegido === 'nuevo' && <p className="flex items-center gap-2 rounded-md bg-primario-suave px-2.5 py-2 text-sm font-medium text-primario-texto"><Bot className="size-4" /> Nuevo asistente</p>}
        </nav>

        {elegido !== null ? (
          <form className="space-y-4 rounded-lg border border-borde bg-superficie p-4" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
            <fieldset disabled={!soyAdmin} className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="block min-w-48 flex-1"><span className="mb-1 block text-sm font-medium">Nombre</span>
                  <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={80} required className={estiloInput} /></label>
                <label className="flex h-8 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} className="size-4" /> Activo</label>
              </div>
              <div><span className="mb-1 block text-sm font-medium">Contesta en</span>
                <div className="flex flex-wrap gap-2">
                  {CANALES.map(([k, t]) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${f.canales.includes(k) ? 'border-primario bg-primario-suave text-primario-texto' : 'border-borde-fuerte text-texto-2'}`}>
                      <input type="checkbox" className="sr-only" checked={f.canales.includes(k)} onChange={(e) => set('canales', e.target.checked ? [...f.canales, k] : f.canales.filter((c) => c !== k))} />{t}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-tenue">Solo puede haber un asistente activo por canal. SMS y WhatsApp usan la Integración telefónica; el correo, los Servicios de correo.</p>
              </div>
              <label className="block"><span className="mb-1 flex items-center justify-between text-sm font-medium">Instrucciones
                <select aria-label="Usar plantilla" value="" onChange={(e) => { const p = PLANTILLAS_ASISTENTE.find((x) => x.id === e.target.value); if (p) { set('instrucciones', p.instrucciones); set('canales', [...p.canales]); } }}
                  className="rounded border border-borde-fuerte bg-superficie px-1.5 py-0.5 text-xs font-normal">
                  <option value="">Usar plantilla…</option>{PLANTILLAS_ASISTENTE.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></span>
                <textarea value={f.instrucciones} onChange={(e) => set('instrucciones', e.target.value)} rows={8} maxLength={8000} className={estiloArea} placeholder="Cómo debe hablar, qué debe conseguir y cuándo pasar a una persona." />
                <span className="text-xs text-tenue">{f.instrucciones.length} / 8000</span></label>
              <label className="block"><span className="mb-1 flex items-center justify-between text-sm font-medium">Base de conocimiento
                <span className="inline-flex cursor-pointer items-center gap-1 text-xs font-normal text-primario-texto"><FileUp className="size-3.5" /> Importar .txt / .md
                  <input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={async (e) => {
                    const a = e.target.files?.[0]; e.target.value = '';
                    if (!a) return;
                    if (a.size > 200_000) { setAviso({ ok: false, error: 'El archivo es demasiado grande (máximo 200 KB).' }); return; }
                    set('conocimiento', `${f.conocimiento}${f.conocimiento ? '\n\n' : ''}${(await a.text()).slice(0, 60000)}`.slice(0, 60000));
                  }} /></span></span>
                <textarea value={f.conocimiento} onChange={(e) => set('conocimiento', e.target.value)} rows={10} maxLength={60000} className={estiloArea}
                  placeholder={'Servicios y precios, horario, dirección, preguntas frecuentes, enlace de reserva, políticas…'} />
                <span className="text-xs text-tenue">{f.conocimiento.length.toLocaleString('es-ES')} / 60 000 · El asistente solo usa esta información; si no sabe algo, lo dice y pasa a una persona.</span></label>
              <details className="rounded-md border border-borde p-3">
                <summary className="cursor-pointer text-sm font-medium">Paso a una persona y límites</summary>
                <div className="mt-3 space-y-3">
                  <label className="block"><span className="mb-1 block text-sm">Palabras que pasan a una persona (separadas por comas)</span>
                    <input value={f.traspaso_palabras.join(', ')} onChange={(e) => set('traspaso_palabras', e.target.value.split(',').map((x) => x.trimStart()).slice(0, 30))} className={estiloInput} /></label>
                  <label className="block"><span className="mb-1 block text-sm">Mensaje al pasar a una persona (opcional)</span>
                    <input value={f.mensaje_traspaso} onChange={(e) => set('mensaje_traspaso', e.target.value)} maxLength={500} className={estiloInput} /></label>
                  <label className="block"><span className="mb-1 block text-sm">Máximo de respuestas por conversación al día</span>
                    <input type="number" min={1} max={200} value={f.max_respuestas} onChange={(e) => set('max_respuestas', Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className={`${estiloInput} w-28`} /></label>
                </div>
              </details>
            </fieldset>
            <Aviso estado={aviso} />
            {soyAdmin ? (
              <div className="flex flex-wrap justify-between gap-2">
                {elegido !== 'nuevo' ? <button type="button" disabled={pendiente} onClick={() => confirm(`¿Borrar «${f.nombre}»?`) && iniciar(async () => { const r = await borrarAsistente(subId, elegido); setAviso(r); if (r.ok) { setElegido(null); router.refresh(); } })}
                  className={`${estilosBoton.secundario} text-peligro`}><Trash2 className="size-4" /> Borrar</button> : <span />}
                <button disabled={pendiente} className={estilosBoton.primario}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
              </div>
            ) : <p className="text-xs text-tenue">Solo un administrador de la subcuenta puede cambiar los asistentes.</p>}
          </form>
        ) : <div className="flex items-center justify-center rounded-lg border border-dashed border-borde-fuerte p-10 text-sm text-tenue">Crea un asistente para empezar.</div>}

        <div className="space-y-4">
          {elegido !== null && <ChatPrueba subId={subId} datos={f} key={String(elegido)} />}
          <div className="rounded-lg border border-borde bg-superficie p-3">
            <h2 className="mb-2 text-sm font-semibold text-texto">Actividad reciente</h2>
            {actividad.length === 0 ? <p className="text-xs text-tenue">Todavía no ha contestado a nadie.</p> : (
              <ul className="space-y-1.5 text-xs">
                {actividad.map((x, i) => (
                  <li key={i} className="flex gap-2"><Insignia tono={x.estado === 'hecho' ? 'verde' : x.estado === 'error' ? 'rojo' : 'gris'}>{{ hecho: 'Contestado', omitido: 'Omitido', error: 'Error', pendiente: 'En cola', procesando: 'Procesando' }[x.estado] ?? x.estado}</Insignia>
                    <span className="min-w-0 flex-1 truncate text-texto-2" title={x.detalle}>{x.detalle || '—'}</span><span className="shrink-0 text-tenue">{fecha(x.creado)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Chat de prueba con la configuración que hay en pantalla (sin guardar ni enviar).
function ChatPrueba({ subId, datos }: { subId: string; datos: DatosAsistente }) {
  const [turnos, setTurnos] = useState<{ de: 'cliente' | 'negocio' | 'aviso'; texto: string }[]>([]);
  const [texto, setTexto] = useState('');
  const [pendiente, iniciar] = useTransition();
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [turnos, pendiente]);
  const enviar = () => {
    const t = texto.trim();
    if (!t || pendiente) return;
    const nuevos = [...turnos, { de: 'cliente' as const, texto: t }];
    setTurnos(nuevos); setTexto('');
    iniciar(async () => {
      const r = await probarAsistente(subId, datos, nuevos.filter((x) => x.de !== 'aviso') as { de: 'cliente' | 'negocio'; texto: string }[]);
      if (!r.ok) { setTurnos((x) => [...x, { de: 'aviso', texto: r.error ?? 'Error' }]); return; }
      setTurnos((x) => [...x, ...(r.respuesta ? [{ de: 'negocio' as const, texto: r.respuesta }] : []), ...(r.traspaso ? [{ de: 'aviso' as const, texto: `Pasaría a una persona: ${r.motivo || 'sin motivo'}` }] : [])]);
    });
  };
  return (
    <div className="flex h-[420px] flex-col rounded-lg border border-borde bg-superficie">
      <div className="flex items-center justify-between border-b border-borde px-3 py-2">
        <h2 className="text-sm font-semibold text-texto">Probar «{datos.nombre}»</h2>
        <button onClick={() => setTurnos([])} className="rounded p-1 text-tenue hover:text-texto" aria-label="Reiniciar prueba" title="Reiniciar"><RotateCcw className="size-4" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {turnos.length === 0 && <p className="text-center text-xs text-tenue">Escribe como si fueras un cliente. Usa lo que hay en pantalla aunque no esté guardado; no se envía nada.</p>}
        {turnos.map((t, i) => t.de === 'aviso'
          ? <p key={i} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{t.texto}</p>
          : (
            <div key={i} className={`flex items-end gap-1.5 ${t.de === 'cliente' ? 'justify-end' : ''}`}>
              {t.de === 'negocio' && <Bot className="mb-1 size-4 shrink-0 text-primario" />}
              <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 ${t.de === 'cliente' ? 'bg-primario text-white' : 'bg-superficie-2 text-texto'}`}>{t.texto}</p>
              {t.de === 'cliente' && <UserRound className="mb-1 size-4 shrink-0 text-tenue" />}
            </div>
          ))}
        {pendiente && <p className="text-xs text-tenue">Escribiendo…</p>}
        <div ref={fin} />
      </div>
      <form className="flex gap-2 border-t border-borde p-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} placeholder="Escribe un mensaje…" className={estiloInput} aria-label="Mensaje de prueba" />
        <button disabled={pendiente || !texto.trim()} className={estilosBoton.primario} aria-label="Enviar"><Send className="size-4" /></button>
      </form>
    </div>
  );
}
