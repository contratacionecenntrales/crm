'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bell, CheckSquare, Clock, FlaskConical, GitBranch, Globe, Loader2, Mail, MessageCircle, MessageSquare,
  Plus, Save, StickyNote, Tag, Tags, Target, Trash2, UserCheck, X, Zap,
} from 'lucide-react';
import { guardarFlujo, pararEjecucion, probarFlujo } from '@/app/subcuenta/[id]/automatizacion/acciones';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { Interruptor } from '@/components/ajustes/Piezas';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import {
  DISPARADORES, PASOS, VARIABLES, nombrePaso, pasoVacio, resumenPaso, type Disparador, type Paso, type TipoPaso,
} from '@/lib/automatizacion/tipos';
import { nombreContacto, type Embudo, type Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

export interface Flujo { id: string; nombre: string; activo: boolean; disparador: Disparador; filtro: Record<string, string | boolean>; pasos: Paso[]; permitir_reentrada: boolean }
export interface Ejecucion {
  id: string; estado: string; paso: number; motivo: string; creado: string; terminado: string | null; siguiente_en: string;
  contacto: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string } | null;
  registro: { paso: number; tipo: string; ok: boolean; detalle: string; ts: string }[];
}
interface Opciones { etiquetas: string[]; embudos: Embudo[]; usuarios: Usuario[]; calendarios: { id: string; nombre: string }[] }

const ICONO: Record<TipoPaso, typeof Mail> = {
  enviar_sms: MessageSquare, enviar_whatsapp: MessageCircle, enviar_email: Mail, anadir_etiqueta: Tag, quitar_etiqueta: Tags,
  asignar_propietario: UserCheck, crear_tarea: CheckSquare, crear_oportunidad: Target, nota: StickyNote, notificar: Bell,
  esperar: Clock, condicion: GitBranch, webhook: Globe,
};
const COLOR: Record<string, string> = { Comunicación: '#155eef', Contacto: '#7a5af8', Interno: '#f79009', Lógica: '#12b76a' };
const grupoDe = (t: TipoPaso) => PASOS.find((p) => p.tipo === t)!.grupo;
const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';
const ESTADOS: Record<string, [string, string]> = {
  pendiente: ['En cola', 'bg-[#eff8ff] text-[#175cd3]'], procesando: ['Ejecutando', 'bg-[#eff8ff] text-[#175cd3]'],
  esperando: ['Esperando', 'bg-[#fef0c7] text-[#93370d]'], completada: ['Completado', 'bg-[#dcfae6] text-[#067647]'],
  terminada: ['Terminado', 'bg-[#f2f4f7] text-[#344054]'], error: ['Error', 'bg-[#fee4e2] text-[#b42318]'],
};

export function Constructor({ subId, zona, flujo, ejecuciones, opciones, soyAdmin, pestanaInicial }: {
  subId: string; zona: string; flujo: Flujo; ejecuciones: Ejecucion[]; opciones: Opciones; soyAdmin: boolean; pestanaInicial: 'constructor' | 'historial';
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState(pestanaInicial);
  const [nombre, setNombre] = useState(flujo.nombre);
  const [activo, setActivo] = useState(flujo.activo);
  const [disparador, setDisparador] = useState<Disparador>(flujo.disparador);
  const [filtro, setFiltro] = useState<Record<string, string | boolean>>(flujo.filtro ?? {});
  const [pasos, setPasos] = useState<Paso[]>(flujo.pasos ?? []);
  const [reentrada, setReentrada] = useState(flujo.permitir_reentrada);
  const [sel, setSel] = useState<'disparador' | number | null>(null);
  const [menuEn, setMenuEn] = useState<number | null>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [cambios, setCambios] = useState(false);
  const [probar, setProbar] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const marcar = () => setCambios(true);
  const sinPermiso = !soyAdmin;

  const guardar = (publicar = activo) => iniciar(async () => {
    const r = await guardarFlujo(subId, flujo.id, { nombre, disparador, filtro, pasos, permitir_reentrada: reentrada, activo: publicar });
    setAviso(r);
    if (r.ok) { setCambios(false); setActivo(publicar); router.refresh(); }
  });
  const insertar = (i: number, tipo: TipoPaso) => {
    setPasos((l) => [...l.slice(0, i), pasoVacio(tipo), ...l.slice(i)]);
    setMenuEn(null);
    setSel(i);
    marcar();
  };
  const ponerPaso = (i: number, p: Paso) => { setPasos((l) => l.map((x, j) => (j === i ? p : x))); marcar(); };
  const mover = (i: number, d: -1 | 1) => {
    setPasos((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
    setSel(i + d);
    marcar();
  };

  return (
    <div className="flex h-[calc(100dvh-93px)] min-h-[520px] flex-col font-sans">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 border-b border-borde bg-superficie px-4 py-2.5">
        <Link href={`/subcuenta/${subId}/automatizacion`} aria-label="Volver a los flujos" className="rounded p-1 text-tenue hover:bg-superficie-2"><ArrowLeft className="size-5" /></Link>
        <input value={nombre} disabled={sinPermiso} onChange={(e) => { setNombre(e.target.value); marcar(); }} maxLength={120} aria-label="Nombre del flujo"
          className="h-9 min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 text-base font-semibold text-texto hover:border-borde-fuerte focus:border-primario focus:outline-none sm:max-w-sm" />
        <nav className="flex gap-1" aria-label="Secciones del flujo">
          {([['constructor', 'Constructor'], ['historial', `Historial (${ejecuciones.length})`]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setPestana(v)} aria-current={pestana === v ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${pestana === v ? 'bg-primario-suave text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>{t}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {cambios && <span className="text-xs text-[#b54708]">Cambios sin guardar</span>}
          <button type="button" onClick={() => setProbar(true)} disabled={!pasos.length} className={estilosBoton.secundario}><FlaskConical className="size-4" /> Probar</button>
          {soyAdmin && (
            <>
              <Interruptor checked={activo} disabled={pendiente} etiqueta={activo ? 'Publicado' : 'Borrador'} onChange={(v) => guardar(v)} />
              <button type="button" disabled={pendiente} onClick={() => guardar()} className={estilosBoton.primario}>
                {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
              </button>
            </>
          )}
        </div>
      </div>
      {aviso && <div className="border-b border-borde bg-superficie px-4 py-2"><Aviso estado={aviso} /></div>}

      {pestana === 'historial' ? (
        <Historial subId={subId} zona={zona} ejecuciones={ejecuciones} pasos={pasos} />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Lienzo */}
          <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(#d0d5dd_1px,transparent_1px)] [background-size:18px_18px] py-8">
            <div className="mx-auto flex w-[380px] max-w-[calc(100%-2rem)] flex-col items-center">
              <button type="button" onClick={() => setSel('disparador')}
                className={`w-full rounded-lg border-2 bg-superficie text-left shadow-xs ${sel === 'disparador' ? 'border-primario' : 'border-transparent hover:border-[#b2ccff]'}`}>
                <div className="flex items-center gap-2 rounded-t-md bg-[#155eef] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"><Zap className="size-3.5" /> Disparador del flujo de trabajo</div>
                <div className="px-4 py-3">
                  <p className="font-medium text-texto">{DISPARADORES.find((d) => d.valor === disparador)?.texto}</p>
                  <p className="text-xs text-tenue">{resumenFiltro(disparador, filtro, opciones)}</p>
                </div>
              </button>
              {pasos.map((p, i) => {
                const Icono = ICONO[p.tipo];
                const color = COLOR[grupoDe(p.tipo)];
                return (
                  <div key={i} className="flex w-full flex-col items-center">
                    <Conector abierto={menuEn === i} alAbrir={() => setMenuEn(menuEn === i ? null : i)} alElegir={(t) => insertar(i, t)} deshabilitado={sinPermiso} />
                    <button type="button" onClick={() => setSel(i)}
                      className={`flex w-full items-start gap-3 rounded-lg border-2 bg-superficie px-4 py-3 text-left shadow-xs ${sel === i ? 'border-primario' : 'border-transparent hover:border-[#b2ccff]'}`}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: color }}><Icono className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-texto">{nombrePaso(p.tipo)}</span>
                        <span className="block truncate text-xs text-tenue">{resumenPaso(p)}</span>
                      </span>
                      <span className="text-xs text-tenue">{i + 1}</span>
                    </button>
                  </div>
                );
              })}
              <Conector abierto={menuEn === pasos.length} alAbrir={() => setMenuEn(menuEn === pasos.length ? null : pasos.length)} alElegir={(t) => insertar(pasos.length, t)} deshabilitado={sinPermiso} />
              <span className="rounded-full bg-[#f2f4f7] dark:bg-superficie-2 px-4 py-1 text-xs font-medium text-[#475467] dark:text-texto-2">FIN</span>
            </div>
          </div>

          {/* Panel lateral */}
          {sel !== null && (
            <aside className="flex w-[400px] max-w-full shrink-0 flex-col border-l border-borde bg-superficie" aria-label="Configurar">
              <div className="flex items-center justify-between border-b border-borde px-4 py-3">
                <h3 className="font-semibold text-texto">{sel === 'disparador' ? 'Disparador' : nombrePaso(pasos[sel].tipo)}</h3>
                <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" className="rounded p-1 text-tenue hover:bg-superficie-2"><X className="size-4" /></button>
              </div>
              <fieldset disabled={sinPermiso} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {sel === 'disparador' ? (
                  <PanelDisparador disparador={disparador} filtro={filtro} opciones={opciones} reentrada={reentrada}
                    alCambiar={(d, f) => { setDisparador(d); setFiltro(f); marcar(); }} alReentrada={(v) => { setReentrada(v); marcar(); }} />
                ) : pasos[sel] ? (
                  <PanelPaso p={pasos[sel]} opciones={opciones} alCambiar={(p) => ponerPaso(sel, p)} />
                ) : null}
              </fieldset>
              {typeof sel === 'number' && pasos[sel] && soyAdmin && (
                <div className="flex items-center gap-1 border-t border-borde px-4 py-3">
                  <button type="button" disabled={sel === 0} onClick={() => mover(sel, -1)} aria-label="Subir" className="rounded p-1.5 text-tenue hover:bg-superficie-2 disabled:opacity-40"><ArrowUp className="size-4" /></button>
                  <button type="button" disabled={sel === pasos.length - 1} onClick={() => mover(sel, 1)} aria-label="Bajar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 disabled:opacity-40"><ArrowDown className="size-4" /></button>
                  <button type="button" onClick={() => { setPasos((l) => l.filter((_, j) => j !== sel)); setSel(null); marcar(); }}
                    className={`${estilosBoton.fantasma} ml-auto text-peligro`}><Trash2 className="size-4" /> Quitar paso</button>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      <Modal abierto={probar} alCerrar={() => setProbar(false)} titulo="Probar el flujo" ancho="max-w-md">
        <ProbarFlujo subId={subId} flujoId={flujo.id} cambios={cambios} alTerminar={(r) => { setProbar(false); setAviso(r); if (r.ok) { setPestana('historial'); router.refresh(); } }} />
      </Modal>
    </div>
  );
}

function Conector({ abierto, alAbrir, alElegir, deshabilitado }: { abierto: boolean; alAbrir: () => void; alElegir: (t: TipoPaso) => void; deshabilitado: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, abierto, alAbrir);
  return (
    <div ref={caja} className="relative flex h-14 flex-col items-center">
      <span className="h-full w-px bg-[#98a2b3]" />
      {!deshabilitado && (
        <button type="button" onClick={alAbrir} aria-label="Añadir paso" title="Añadir paso"
          className="absolute top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#98a2b3] bg-superficie text-[#475467] dark:text-texto-2 hover:border-primario hover:text-primario">
          <Plus className="size-3.5" />
        </button>
      )}
      {abierto && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-72 -translate-x-1/2 rounded-lg border bg-superficie p-1 shadow-xl">
          {(['Comunicación', 'Contacto', 'Interno', 'Lógica'] as const).map((g) => (
            <div key={g}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">{g}</p>
              {PASOS.filter((p) => p.grupo === g).map((p) => {
                const Icono = ICONO[p.tipo];
                return (
                  <button key={p.tipo} type="button" onClick={() => alElegir(p.tipo)} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-[#344054] hover:bg-superficie-2 dark:text-texto-2">
                    <Icono className="size-4" style={{ color: COLOR[g] }} /> {p.texto}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function resumenFiltro(d: Disparador, f: Record<string, string | boolean>, o: Opciones): string {
  const cal = o.calendarios.find((c) => c.id === f.calendario_id)?.nombre;
  const etapa = o.embudos.flatMap((e) => e.etapas).find((e) => e.id === f.etapa_id)?.nombre;
  switch (d) {
    case 'etiqueta_anadida': return f.etiqueta ? `Etiqueta «${f.etiqueta}»` : 'Cualquier etiqueta';
    case 'cita_reservada': return `${cal ? `Calendario «${cal}»` : 'Cualquier calendario'}${f.solo_online ? ' · solo reservas online' : ''}`;
    case 'cita_cancelada': return cal ? `Calendario «${cal}»` : 'Cualquier calendario';
    case 'cita_estado': return `${f.estado ? { confirmada: 'Confirmada', presentado: 'Se presentó', no_presentado: 'No se presentó', nueva: 'Sin confirmar' }[String(f.estado)] : 'Cualquier estado'}${cal ? ` · «${cal}»` : ''}`;
    case 'mensaje_recibido': return `${f.canal ? (f.canal === 'chat' ? 'Chat web' : String(f.canal).toUpperCase()) : 'Cualquier canal'}${f.palabra ? ` · contiene «${f.palabra}»` : ''}`;
    case 'oportunidad_etapa': return etapa ? `Etapa «${etapa}»` : 'Cualquier etapa';
    case 'manual': return 'Se añade a los contactos a mano';
    default: return 'Sin filtros';
  }
}

function PanelDisparador({ disparador, filtro, opciones, reentrada, alCambiar, alReentrada }: {
  disparador: Disparador; filtro: Record<string, string | boolean>; opciones: Opciones; reentrada: boolean;
  alCambiar: (d: Disparador, f: Record<string, string | boolean>) => void; alReentrada: (v: boolean) => void;
}) {
  const f = (k: string, v: string | boolean) => alCambiar(disparador, { ...filtro, [k]: v });
  const embudo = opciones.embudos.find((e) => e.id === filtro.embudo_id);
  return (
    <>
      <label className="block"><span className={etiqueta}>Cuándo empieza</span>
        <select value={disparador} onChange={(e) => alCambiar(e.target.value as Disparador, {})} className={estiloInput}>
          {DISPARADORES.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}
        </select>
        <span className="mt-1 block text-xs text-tenue">{DISPARADORES.find((d) => d.valor === disparador)?.ayuda}</span>
      </label>
      {disparador === 'etiqueta_anadida' && (
        <label className="block"><span className={etiqueta}>Etiqueta</span>
          <input list="aut-etiquetas" value={String(filtro.etiqueta ?? '')} onChange={(e) => f('etiqueta', e.target.value)} placeholder="Cualquiera" className={estiloInput} />
          <datalist id="aut-etiquetas">{opciones.etiquetas.map((t) => <option key={t} value={t} />)}</datalist></label>
      )}
      {['cita_reservada', 'cita_cancelada', 'cita_estado'].includes(disparador) && (
        <label className="block"><span className={etiqueta}>Calendario</span>
          <select value={String(filtro.calendario_id ?? '')} onChange={(e) => f('calendario_id', e.target.value)} className={estiloInput}>
            <option value="">Cualquiera</option>{opciones.calendarios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></label>
      )}
      {disparador === 'cita_reservada' && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(filtro.solo_online)} onChange={(e) => f('solo_online', e.target.checked)} className="size-4" /> Solo reservas hechas por el cliente online</label>
      )}
      {disparador === 'cita_estado' && (
        <label className="block"><span className={etiqueta}>Estado</span>
          <select value={String(filtro.estado ?? '')} onChange={(e) => f('estado', e.target.value)} className={estiloInput}>
            <option value="">Cualquiera</option><option value="confirmada">Confirmada</option><option value="presentado">Se presentó</option>
            <option value="no_presentado">No se presentó</option><option value="nueva">Sin confirmar</option>
          </select></label>
      )}
      {disparador === 'mensaje_recibido' && (<>
        <label className="block"><span className={etiqueta}>Canal</span>
          <select value={String(filtro.canal ?? '')} onChange={(e) => f('canal', e.target.value)} className={estiloInput}>
            <option value="">Cualquiera</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Correo</option><option value="chat">Chat web</option>
          </select></label>
        <label className="block"><span className={etiqueta}>Contiene la palabra</span>
          <input value={String(filtro.palabra ?? '')} onChange={(e) => f('palabra', e.target.value)} maxLength={100} placeholder="Ej. precio (opcional)" className={estiloInput} /></label>
      </>)}
      {disparador === 'oportunidad_etapa' && (<>
        <label className="block"><span className={etiqueta}>Embudo</span>
          <select value={String(filtro.embudo_id ?? '')} onChange={(e) => alCambiar(disparador, { ...filtro, embudo_id: e.target.value, etapa_id: '' })} className={estiloInput}>
            <option value="">Cualquiera</option>{opciones.embudos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select></label>
        {embudo && (
          <label className="block"><span className={etiqueta}>Etapa</span>
            <select value={String(filtro.etapa_id ?? '')} onChange={(e) => f('etapa_id', e.target.value)} className={estiloInput}>
              <option value="">Cualquiera</option>{embudo.etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select></label>
        )}
      </>)}
      <label className="flex items-start gap-2 border-t border-borde pt-4 text-sm">
        <input type="checkbox" checked={reentrada} onChange={(e) => alReentrada(e.target.checked)} className="mt-0.5 size-4" />
        <span><span className="block font-medium text-texto">Permitir volver a entrar</span><span className="text-xs text-tenue">Un contacto puede estar varias veces a la vez en el flujo (máximo 10 entradas por hora).</span></span>
      </label>
    </>
  );
}

function Variables({ alInsertar }: { alInsertar: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {VARIABLES.map(([k, t]) => (
        <button key={k} type="button" onClick={() => alInsertar(`{{${k}}}`)} title={`{{${k}}}`}
          className="rounded-full border border-borde-fuerte px-2 py-0.5 text-[11px] text-[#475467] dark:text-texto-2 hover:border-primario hover:text-primario">{t}</button>
      ))}
    </div>
  );
}

function PanelPaso({ p, opciones, alCambiar }: { p: Paso; opciones: Opciones; alCambiar: (p: Paso) => void }) {
  const set = <K extends string>(k: K, v: unknown) => alCambiar({ ...p, [k]: v } as Paso);
  const area = useRef<HTMLTextAreaElement>(null);
  const insertar = (v: string) => {
    if (!('texto' in p)) return;
    const a = area.current;
    const pos = a?.selectionStart ?? p.texto.length;
    set('texto', p.texto.slice(0, pos) + v + p.texto.slice(pos));
  };
  const personas = (k: 'usuario_id' | 'asignado_id', vacio: string) => (
    <select value={String((p as Record<string, unknown>)[k] ?? '')} onChange={(e) => set(k, e.target.value)} className={estiloInput}>
      <option value="">{vacio}</option>{opciones.usuarios.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
    </select>
  );
  switch (p.tipo) {
    case 'enviar_sms': case 'enviar_whatsapp': case 'enviar_email': case 'nota':
      return (<>
        {p.tipo === 'enviar_email' && <label className="block"><span className={etiqueta}>Asunto</span><input value={p.asunto} onChange={(e) => set('asunto', e.target.value)} maxLength={300} className={estiloInput} /></label>}
        <label className="block"><span className={etiqueta}>{p.tipo === 'nota' ? 'Texto de la nota' : 'Mensaje'}</span>
          <textarea ref={area} value={p.texto} onChange={(e) => set('texto', e.target.value)} rows={p.tipo === 'enviar_email' ? 10 : 6} className={estiloArea} /></label>
        <div><span className="mb-1 block text-xs font-medium text-tenue">Insertar dato</span><Variables alInsertar={insertar} /></div>
        {p.tipo !== 'nota' && <p className="text-xs text-tenue">Se envía con la cuenta configurada en Integración telefónica o Servicios de correo y queda en Conversaciones. Si el contacto tiene «No molestar», no se envía.</p>}
      </>);
    case 'anadir_etiqueta': case 'quitar_etiqueta':
      return (<label className="block"><span className={etiqueta}>Etiqueta</span>
        <input list="aut-etiquetas-paso" value={p.etiqueta} onChange={(e) => set('etiqueta', e.target.value)} maxLength={60} className={estiloInput} />
        <datalist id="aut-etiquetas-paso">{opciones.etiquetas.map((t) => <option key={t} value={t} />)}</datalist></label>);
    case 'asignar_propietario':
      return <label className="block"><span className={etiqueta}>Asignar a</span>{personas('usuario_id', 'Elige una persona')}</label>;
    case 'crear_tarea':
      return (<>
        <label className="block"><span className={etiqueta}>Título</span><input value={p.titulo} onChange={(e) => set('titulo', e.target.value)} maxLength={200} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Descripción</span><textarea value={p.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={3} className={estiloArea} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={etiqueta}>Vence en (días)</span><input type="number" min={0} max={365} value={p.dias} onChange={(e) => set('dias', Number(e.target.value))} className={estiloInput} /></label>
          <label className="block"><span className={etiqueta}>Asignada a</span>{personas('asignado_id', 'Propietario del contacto')}</label>
        </div>
      </>);
    case 'crear_oportunidad': {
      const embudo = opciones.embudos.find((e) => e.id === p.embudo_id);
      return (<>
        <label className="block"><span className={etiqueta}>Nombre</span><input value={p.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={160} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Embudo</span>
          <select value={p.embudo_id} onChange={(e) => alCambiar({ ...p, embudo_id: e.target.value, etapa_id: opciones.embudos.find((x) => x.id === e.target.value)?.etapas[0]?.id ?? '' })} className={estiloInput}>
            <option value="">Elige un embudo</option>{opciones.embudos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select></label>
        {embudo && <label className="block"><span className={etiqueta}>Etapa</span>
          <select value={p.etapa_id} onChange={(e) => set('etapa_id', e.target.value)} className={estiloInput}>{embudo.etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>}
        <label className="block"><span className={etiqueta}>Valor</span><input type="number" min={0} step="0.01" value={p.valor} onChange={(e) => set('valor', Number(e.target.value))} className={estiloInput} /></label>
      </>);
    }
    case 'notificar':
      return (<>
        <label className="block"><span className={etiqueta}>Avisar a</span>{personas('usuario_id', 'Propietario del contacto')}</label>
        <label className="block"><span className={etiqueta}>Título</span><input value={p.titulo} onChange={(e) => set('titulo', e.target.value)} maxLength={200} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Texto</span><textarea ref={area} value={p.texto} onChange={(e) => set('texto', e.target.value)} rows={3} className={estiloArea} /></label>
        <Variables alInsertar={insertar} />
      </>);
    case 'esperar':
      return (<div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={etiqueta}>Esperar</span><input type="number" min={1} max={365} value={p.cantidad} onChange={(e) => set('cantidad', Number(e.target.value))} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Unidad</span>
          <select value={p.unidad} onChange={(e) => set('unidad', e.target.value)} className={estiloInput}><option value="minutos">minutos</option><option value="horas">horas</option><option value="dias">días</option></select></label>
        <p className="col-span-2 text-xs text-tenue">Los pasos se revisan cada 5 minutos, así que una espera corta puede alargarse hasta 5 minutos.</p>
      </div>);
    case 'condicion':
      return (<>
        <label className="block"><span className={etiqueta}>Seguir solo si</span>
          <select value={p.regla} onChange={(e) => set('regla', e.target.value)} className={estiloInput}>
            <option value="tiene_etiqueta">El contacto tiene la etiqueta…</option><option value="no_tiene_etiqueta">El contacto no tiene la etiqueta…</option>
            <option value="tiene_email">El contacto tiene correo</option><option value="tiene_telefono">El contacto tiene teléfono</option>
          </select></label>
        {p.regla.includes('etiqueta') && <label className="block"><span className={etiqueta}>Etiqueta</span>
          <input list="aut-etiquetas-cond" value={p.etiqueta} onChange={(e) => set('etiqueta', e.target.value)} maxLength={60} className={estiloInput} />
          <datalist id="aut-etiquetas-cond">{opciones.etiquetas.map((t) => <option key={t} value={t} />)}</datalist></label>}
        <p className="text-xs text-tenue">Si no se cumple, el flujo termina para ese contacto.</p>
      </>);
    case 'webhook':
      return (<>
        <label className="block"><span className={etiqueta}>URL (https)</span><input value={p.url} onChange={(e) => set('url', e.target.value)} maxLength={500} placeholder="https://hooks.zapier.com/…" className={estiloInput} /></label>
        <p className="text-xs text-tenue">Se envía un POST con JSON: el evento, los datos del disparador y el contacto (nombre, correo, teléfono, etiquetas). Sirve para Zapier, Make, n8n…</p>
      </>);
  }
}

function ProbarFlujo({ subId, flujoId, cambios, alTerminar }: { subId: string; flujoId: string; cambios: boolean; alTerminar: (r: Resultado) => void }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const id = new FormData(e.currentTarget).get('contacto_id');
      if (typeof id !== 'string' || !id) { setError('Elige un contacto.'); return; }
      iniciar(async () => { const r = await probarFlujo(subId, flujoId, id); if (r.ok) alTerminar(r); else setError(r.error ?? 'Error'); });
    }}>
      {cambios && <p className="rounded-lg bg-[#fffaeb] px-3 py-2 text-sm text-[#b54708]">Tienes cambios sin guardar: la prueba usa la última versión guardada.</p>}
      <p className="text-sm text-tenue">El contacto entra en el flujo ahora mismo y se ejecutan los pasos hasta la primera espera. Los mensajes se envían de verdad.</p>
      <div><span className={etiqueta}>Contacto</span><SelectorContacto subId={subId} name="contacto_id" requerido /></div>
      {error && <p role="alert" className="text-sm text-peligro">{error}</p>}
      <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.primario}>{pendiente && <Loader2 className="size-4 animate-spin" />} Ejecutar prueba</button></div>
    </form>
  );
}

function Historial({ subId, zona, ejecuciones, pasos }: { subId: string; zona: string; ejecuciones: Ejecucion[]; pasos: Paso[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const f = (d: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: zona }).format(new Date(d));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-borde-fuerte bg-superficie">
        {ejecuciones.length === 0 ? <p className="px-4 py-12 text-center text-sm text-tenue">Todavía no ha entrado nadie en este flujo.</p> : (
          <ul className={`divide-y divide-borde ${pendiente ? 'opacity-60' : ''}`}>
            {ejecuciones.map((e) => {
              const est = ESTADOS[e.estado] ?? ESTADOS.pendiente;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setAbierta(abierta === e.id ? null : e.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-superficie-2">
                    <span className="min-w-40 flex-1 font-medium text-texto">{e.contacto ? nombreContacto(e.contacto) : 'Contacto borrado'}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${est[1]}`}>{est[0]}</span>
                    <span className="text-xs text-tenue">Paso {Math.min(e.paso + (e.estado === 'completada' ? 0 : 1), Math.max(1, pasos.length))}</span>
                    {e.estado === 'esperando' && <span className="text-xs text-tenue">hasta {f(e.siguiente_en)}</span>}
                    <span className="text-xs text-tenue">{f(e.creado)}</span>
                  </button>
                  {abierta === e.id && (
                    <div className="space-y-2 bg-superficie-2 px-4 py-3 text-sm">
                      {e.motivo && <p className="text-tenue">{e.motivo}</p>}
                      {[...e.registro].sort((a, b) => a.ts.localeCompare(b.ts)).map((r, i) => (
                        <p key={i} className="flex gap-2"><span className={r.ok ? 'text-[#067647]' : 'text-[#b42318]'}>{r.ok ? '✓' : '✗'}</span>
                          <span className="font-medium text-texto">{r.paso + 1}. {nombrePaso(r.tipo)}</span><span className="text-tenue">{r.detalle}</span>
                          <span className="ml-auto text-xs text-tenue">{f(r.ts)}</span></p>
                      ))}
                      {e.registro.length === 0 && <p className="text-tenue">Aún no se ha ejecutado ningún paso.</p>}
                      {['pendiente', 'esperando', 'procesando'].includes(e.estado) && (
                        <button type="button" className="text-sm font-medium text-peligro hover:underline"
                          onClick={() => iniciar(async () => { const r = await pararEjecucion(subId, e.id); if (!r.ok) alert(r.error); })}>Sacar del flujo</button>
                      )}
                      {e.contacto && <Link href={`/subcuenta/${subId}/contacto/${e.contacto.id}`} className="ml-4 text-sm font-medium text-primario-texto hover:underline">Ver contacto</Link>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
