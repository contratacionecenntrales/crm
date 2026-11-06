'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bell, CheckSquare, Clock, FlaskConical, GitBranch, Globe, Loader2, Mail, MessageCircle, MessageSquare,
  Plus, Save, StickyNote, Tag, Tags, Target, Trash2, UserCheck, X, Zap, Sparkles, Star, Split, Cloud, Braces, UserCog, Copy, RefreshCw,
} from 'lucide-react';
import { insertar as insertarEn, listaEn, mover as moverEn, obtener, profundidad, quitar as quitarEn, reemplazar, rutaNodo } from '@/lib/automatizacion/arbol';
import { guardarFlujo, pararEjecucion, probarFlujo, urlWebhook } from '@/app/subcuenta/[id]/automatizacion/acciones';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { Interruptor } from '@/components/ajustes/Piezas';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import {
  DISPARADORES, OPERADORES, PASOS, VARIABLES, nombrePaso, pasoVacio, resumenPaso, type Disparador, type Paso, type PasoSi, type Regla, type TipoPaso,
} from '@/lib/automatizacion/tipos';
import { nombreContacto, type Embudo, type Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

export interface Flujo { id: string; nombre: string; activo: boolean; disparador: Disparador; filtro: Record<string, string | boolean>; pasos: Paso[]; permitir_reentrada: boolean }
export interface Ejecucion {
  id: string; estado: string; paso: number; motivo: string; creado: string; terminado: string | null; siguiente_en: string;
  contacto: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string } | null;
  registro: { paso: number; tipo: string; ok: boolean; detalle: string; ts: string }[];
}
interface Opciones { etiquetas: string[]; embudos: Embudo[]; usuarios: Usuario[]; calendarios: { id: string; nombre: string }[]; embudosWeb: { id: string; nombre: string }[] }

const ICONO: Record<TipoPaso, typeof Mail> = {
  enviar_sms: MessageSquare, enviar_whatsapp: MessageCircle, enviar_email: Mail, anadir_etiqueta: Tag, quitar_etiqueta: Tags,
  asignar_propietario: UserCheck, crear_tarea: CheckSquare, crear_oportunidad: Target, nota: StickyNote, notificar: Bell,
  esperar: Clock, condicion: GitBranch, webhook: Globe, ia_mensaje: Sparkles, pedir_resena: Star,
  si: Split, http: Cloud, variable: Braces, actualizar_contacto: UserCog,
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
  const [sel, setSel] = useState<'disparador' | string | null>(null);
  const [menuEn, setMenuEn] = useState<string | null>(null);
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
  // Edición del árbol de pasos por rutas ('2', '2.si.0'…).
  const insertar = (lista: string, i: number, tipo: TipoPaso) => {
    setPasos((l) => insertarEn(l, lista, i, pasoVacio(tipo)));
    setMenuEn(null);
    setSel(rutaNodo(lista, i));
    marcar();
  };
  const ponerPaso = (nodo: string, p: Paso) => { setPasos((l) => reemplazar(l, nodo, p)); marcar(); };
  const mover = (nodo: string, d: -1 | 1) => { const m = moverEn(pasos, nodo, d); setPasos(m.pasos); setSel(m.nodo); marcar(); };
  const pasoSel = typeof sel === 'string' && sel !== 'disparador' ? obtener(pasos, sel) : null;
  const lienzo = { sel, setSel, menuEn, setMenuEn, insertar, sinPermiso };

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
            <div className="mx-auto flex w-max min-w-[380px] max-w-none flex-col items-center px-4">
              <button type="button" onClick={() => setSel('disparador')}
                className={`w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border-2 bg-superficie text-left shadow-xs ${sel === 'disparador' ? 'border-primario' : 'border-transparent hover:border-[#b2ccff]'}`}>
                <div className="flex items-center gap-2 rounded-t-md bg-[#155eef] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"><Zap className="size-3.5" /> Disparador del flujo de trabajo</div>
                <div className="px-4 py-3">
                  <p className="font-medium text-texto">{DISPARADORES.find((d) => d.valor === disparador)?.texto}</p>
                  <p className="text-xs text-tenue">{resumenFiltro(disparador, filtro, opciones)}</p>
                </div>
              </button>
              <ListaPasos ruta="" lista={pasos} c={lienzo} />
              <span className="rounded-full bg-[#f2f4f7] dark:bg-superficie-2 px-4 py-1 text-xs font-medium text-[#475467] dark:text-texto-2">FIN</span>
            </div>
          </div>

          {/* Panel lateral */}
          {sel !== null && (
            <aside className="flex w-[400px] max-w-full shrink-0 flex-col border-l border-borde bg-superficie" aria-label="Configurar">
              <div className="flex items-center justify-between border-b border-borde px-4 py-3">
                <h3 className="font-semibold text-texto">{sel === 'disparador' ? 'Disparador' : pasoSel ? nombrePaso(pasoSel.tipo) : ''}</h3>
                <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" className="rounded p-1 text-tenue hover:bg-superficie-2"><X className="size-4" /></button>
              </div>
              <fieldset disabled={sinPermiso} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {sel === 'disparador' ? (
                  <PanelDisparador subId={subId} flujoId={flujo.id} disparador={disparador} filtro={filtro} opciones={opciones} reentrada={reentrada}
                    alCambiar={(d, f) => { setDisparador(d); setFiltro(f); marcar(); }} alReentrada={(v) => { setReentrada(v); marcar(); }} />
                ) : pasoSel && typeof sel === 'string' ? (
                  <PanelPaso p={pasoSel} opciones={opciones} alCambiar={(p) => ponerPaso(sel, p)} />
                ) : null}
              </fieldset>
              {typeof sel === 'string' && pasoSel && soyAdmin && (
                <div className="flex items-center gap-1 border-t border-borde px-4 py-3">
                  <button type="button" onClick={() => mover(sel, -1)} aria-label="Subir" className="rounded p-1.5 text-tenue hover:bg-superficie-2 disabled:opacity-40"><ArrowUp className="size-4" /></button>
                  <button type="button" onClick={() => mover(sel, 1)} aria-label="Bajar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 disabled:opacity-40"><ArrowDown className="size-4" /></button>
                  <button type="button" onClick={() => { if (pasoSel.tipo === 'si' && (pasoSel.si.length || pasoSel.no.length) && !confirm('Se quitarán también los pasos de sus ramas. ¿Seguir?')) return; setPasos((l) => quitarEn(l, sel)); setSel(null); marcar(); }}
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

interface Lienzo { sel: 'disparador' | string | null; setSel: (s: string) => void; menuEn: string | null; setMenuEn: (s: string | null) => void; insertar: (lista: string, i: number, t: TipoPaso) => void; sinPermiso: boolean }

// Lista de pasos (raíz o rama). Un nodo «si» abre dos columnas: «sí» y «si no».
function ListaPasos({ ruta, lista, c }: { ruta: string; lista: Paso[]; c: Lienzo }) {
  const clave = (i: number) => `${ruta}#${i}`;
  const nivel = profundidad(ruta);
  const conector = (i: number) => (
    <Conector abierto={c.menuEn === clave(i)} alAbrir={() => c.setMenuEn(c.menuEn === clave(i) ? null : clave(i))} alElegir={(t) => c.insertar(ruta, i, t)} deshabilitado={c.sinPermiso} sinRamas={nivel >= 3} />
  );
  return (
    <>
      {lista.map((p, i) => {
        const nodo = rutaNodo(ruta, i);
        const Icono = ICONO[p.tipo];
        const color = COLOR[grupoDe(p.tipo)];
        return (
          <div key={nodo} className="flex flex-col items-center">
            {conector(i)}
            <button type="button" onClick={() => c.setSel(nodo)}
              className={`flex w-[340px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border-2 bg-superficie px-4 py-3 text-left shadow-xs ${c.sel === nodo ? 'border-primario' : 'border-transparent hover:border-[#b2ccff]'}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: color }}><Icono className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-texto">{nombrePaso(p.tipo)}</span>
                <span className="block truncate text-xs text-tenue">{resumenPaso(p)}</span>
              </span>
            </button>
            {p.tipo === 'si' && (
              <div className="mt-0 flex flex-col items-center">
                <span className="h-5 w-px bg-[#98a2b3]" />
                <div className="flex items-start gap-6 border-t border-[#98a2b3] pt-0">
                  {(['si', 'no'] as const).map((rama) => (
                    <div key={rama} className="flex flex-col items-center">
                      <span className={`mt-[-1px] rounded-b-md px-3 py-0.5 text-[11px] font-semibold text-white ${rama === 'si' ? 'bg-[#12b76a]' : 'bg-[#f04438]'}`}>{rama === 'si' ? 'SÍ' : 'SI NO'}</span>
                      <ListaPasos ruta={`${nodo}.${rama}`} lista={(p as PasoSi)[rama]} c={c} />
                      <span className="h-4 w-px bg-[#98a2b3]" />
                    </div>
                  ))}
                </div>
                <span className="h-px w-full" />
              </div>
            )}
          </div>
        );
      })}
      {conector(lista.length)}
    </>
  );
}

function Conector({ abierto, alAbrir, alElegir, deshabilitado, sinRamas }: { abierto: boolean; alAbrir: () => void; alElegir: (t: TipoPaso) => void; deshabilitado: boolean; sinRamas?: boolean }) {
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
              {PASOS.filter((p) => p.grupo === g && !(sinRamas && p.tipo === 'si')).map((p) => {
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
    case 'formulario_enviado': { const w = o.embudosWeb.find((e) => e.id === f.embudo_web_id)?.nombre; return w ? `Embudo «${w}»` : 'Cualquier formulario'; }
    case 'manual': return 'Se añade a los contactos a mano';
    default: return 'Sin filtros';
  }
}

function PanelDisparador({ subId, flujoId, disparador, filtro, opciones, reentrada, alCambiar, alReentrada }: {
  subId: string; flujoId: string; disparador: Disparador; filtro: Record<string, string | boolean>; opciones: Opciones; reentrada: boolean;
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
      {disparador === 'webhook' && <PanelWebhook subId={subId} flujoId={flujoId} filtro={filtro} alCambiar={(k, v) => f(k, v)} />}
      {disparador === 'formulario_enviado' && (
        <label className="block"><span className={etiqueta}>Embudo o página</span>
          <select value={String(filtro.embudo_web_id ?? '')} onChange={(e) => f('embudo_web_id', e.target.value)} className={estiloInput}>
            <option value="">Cualquiera</option>{opciones.embudosWeb.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <span className="mt-1 block text-xs text-tenue">Usa {'{{contacto.nombre}}'} y el resto de variables en los pasos; las respuestas extra quedan en las notas del contacto.</span></label>
      )}
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
    case 'pedir_resena':
      return (<>
        <label className="block"><span className={etiqueta}>Canal</span>
          <select value={p.canal} onChange={(e) => set('canal', e.target.value)} className={estiloInput}>
            <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Correo</option>
          </select></label>
        <p className="text-xs text-tenue">Envía el mensaje de Reputación con un enlace de valoración. Las buenas van a tu ficha de Google; las malas te llegan en privado. Como mucho una por contacto y semana.</p>
      </>);
    case 'si':
      return <PanelSi p={p} alCambiar={alCambiar} etiquetas={opciones.etiquetas} />;
    case 'http':
      return (<>
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <label className="block"><span className={etiqueta}>Método</span>
            <select value={p.metodo} onChange={(e) => set('metodo', e.target.value)} className={estiloInput}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="block min-w-0"><span className={etiqueta}>URL (https)</span><input value={p.url} onChange={(e) => set('url', e.target.value)} maxLength={1000} className={estiloInput} placeholder="https://api.ejemplo.com/clientes" /></label>
        </div>
        <div><span className={etiqueta}>Cabeceras</span>
          {p.cabeceras.map((h, i) => (
            <div key={i} className="mb-1.5 flex gap-1">
              <input value={h.nombre} onChange={(e) => set('cabeceras', p.cabeceras.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} placeholder="Authorization" className={`${estiloInput} w-36`} aria-label="Nombre de la cabecera" />
              <input value={h.valor} onChange={(e) => set('cabeceras', p.cabeceras.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} placeholder="Bearer …" className={estiloInput} aria-label="Valor de la cabecera" />
              <button type="button" onClick={() => set('cabeceras', p.cabeceras.filter((_, j) => j !== i))} aria-label="Quitar cabecera" className="rounded p-1 text-tenue hover:text-peligro"><Trash2 className="size-4" /></button>
            </div>
          ))}
          {p.cabeceras.length < 10 && <button type="button" onClick={() => set('cabeceras', [...p.cabeceras, { nombre: '', valor: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Añadir cabecera</button>}
        </div>
        {p.metodo !== 'GET' && p.metodo !== 'DELETE' && (
          <label className="block"><span className={etiqueta}>Cuerpo (JSON)</span>
            <textarea value={p.cuerpo} onChange={(e) => set('cuerpo', e.target.value)} rows={7} className={`${estiloArea} font-mono text-xs`} /></label>
        )}
        <label className="block"><span className={etiqueta}>Guardar la respuesta como</span>
          <input value={p.guardar} onChange={(e) => set('guardar', e.target.value.toLowerCase())} maxLength={40} className={estiloInput} /></label>
        <p className="rounded bg-superficie-2 p-2 text-xs text-tenue">Usa en los pasos siguientes <code>{`{{var.${p.guardar}.estado}}`}</code> (código HTTP) y <code>{`{{var.${p.guardar}.datos.campo}}`}</code> (datos de la respuesta). En URL, cabeceras y cuerpo puedes usar {'{{contacto.email}}'}, {'{{webhook.campo}}'}, {'{{var.x}}'}… Solo direcciones https públicas.</p>
      </>);
    case 'variable':
      return (<>
        <label className="block"><span className={etiqueta}>Nombre</span><input value={p.nombre} onChange={(e) => set('nombre', e.target.value.toLowerCase())} maxLength={40} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Valor</span><textarea value={p.valor} onChange={(e) => set('valor', e.target.value)} rows={3} maxLength={5000} className={estiloArea} placeholder="{{webhook.pedido.total}}" /></label>
        <p className="text-xs text-tenue">Después úsala como <code>{`{{var.${p.nombre}}}`}</code> en mensajes, reglas o peticiones.</p>
      </>);
    case 'actualizar_contacto':
      return (<>
        <label className="block"><span className={etiqueta}>Campo</span>
          <select value={p.campo} onChange={(e) => set('campo', e.target.value)} className={estiloInput}>
            <option value="nombre">Nombre</option><option value="apellidos">Apellidos</option><option value="email">Correo</option><option value="telefono">Teléfono</option><option value="fuente">Fuente</option>
          </select></label>
        <label className="block"><span className={etiqueta}>Nuevo valor</span><input value={p.valor} onChange={(e) => set('valor', e.target.value)} maxLength={300} className={estiloInput} placeholder="{{webhook.nombre}}" /></label>
      </>);
    case 'ia_mensaje':
      return (<>
        <label className="block"><span className={etiqueta}>Canal</span>
          <select value={p.canal} onChange={(e) => set('canal', e.target.value)} className={estiloInput}>
            <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Correo</option>
          </select></label>
        <label className="block"><span className={etiqueta}>Qué tiene que escribir la IA</span>
          <textarea value={p.instrucciones} onChange={(e) => set('instrucciones', e.target.value)} rows={7} maxLength={4000} className={estiloArea} /></label>
        <p className="text-xs text-tenue">La IA redacta un mensaje personalizado con los datos del contacto y su conversación reciente, y lo envía. Necesita la función «IA» en el plan; cuenta para el límite diario de respuestas con IA.</p>
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

// Reglas de una rama «si / si no».
const CAMPOS_REGLA: [string, string][] = [
  ['contacto.etiquetas', 'Etiquetas del contacto'], ['contacto.email', 'Correo'], ['contacto.telefono', 'Teléfono'], ['contacto.nombre', 'Nombre'],
  ['contacto.fuente', 'Fuente'], ['mensaje.texto', 'Texto del mensaje recibido'], ['cita.fecha', 'Fecha de la cita'],
];
function PanelSi({ p, alCambiar, etiquetas }: { p: PasoSi; alCambiar: (p: Paso) => void; etiquetas: string[] }) {
  const set = (reglas: Regla[]) => alCambiar({ ...p, reglas });
  return (<>
    <label className="block"><span className={etiqueta}>Se cumple si</span>
      <select value={p.modo} onChange={(e) => alCambiar({ ...p, modo: e.target.value as PasoSi['modo'] })} className={estiloInput}>
        <option value="todas">Se cumplen todas las reglas</option><option value="alguna">Se cumple alguna regla</option>
      </select></label>
    {p.reglas.map((x, i) => (
      <div key={i} className="space-y-1.5 rounded-lg border border-borde p-2.5">
        <input list="aut-campos-regla" value={x.campo} onChange={(e) => set(p.reglas.map((y, j) => (j === i ? { ...y, campo: e.target.value } : y)))} placeholder="contacto.etiquetas · var.respuesta.estado · webhook.plan" className={estiloInput} aria-label="Dato" />
        <div className="flex gap-1.5">
          <select value={x.operador} onChange={(e) => set(p.reglas.map((y, j) => (j === i ? { ...y, operador: e.target.value as Regla['operador'] } : y)))} className={`${estiloInput} w-40`} aria-label="Operador">
            {OPERADORES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          {!['vacio', 'no_vacio'].includes(x.operador) && (
            <input list={x.campo === 'contacto.etiquetas' ? 'aut-etiquetas-regla' : undefined} value={x.valor} onChange={(e) => set(p.reglas.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} placeholder="valor" className={estiloInput} aria-label="Valor" />
          )}
          {p.reglas.length > 1 && <button type="button" onClick={() => set(p.reglas.filter((_, j) => j !== i))} aria-label="Quitar regla" className="rounded p-1 text-tenue hover:text-peligro"><Trash2 className="size-4" /></button>}
        </div>
      </div>
    ))}
    <datalist id="aut-campos-regla">{CAMPOS_REGLA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</datalist>
    <datalist id="aut-etiquetas-regla">{etiquetas.map((t) => <option key={t} value={t} />)}</datalist>
    {p.reglas.length < 10 && <button type="button" onClick={() => set([...p.reglas, { campo: 'contacto.email', operador: 'no_vacio', valor: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Añadir regla</button>}
    <p className="text-xs text-tenue">Si se cumple, sigue por la rama «SÍ»; si no, por «SI NO». Después, las dos ramas continúan con los pasos de debajo.</p>
  </>);
}

// Disparador «Webhook entrante»: URL secreta y qué campos identifican al contacto.
function PanelWebhook({ subId, flujoId, filtro, alCambiar }: { subId: string; flujoId: string; filtro: Record<string, string | boolean>; alCambiar: (k: string, v: string) => void }) {
  const [url, setUrl] = useState('');
  const [r, setR] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const pedir = (renovar: boolean) => iniciar(async () => { const x = await urlWebhook(subId, flujoId, renovar); setR(x.ok && !x.mensaje ? null : x); if (x.ok && x.url) setUrl(x.url); });
  return (<>
    <div className="rounded-lg border border-borde bg-superficie-2 p-3">
      <span className={etiqueta}>URL del webhook (POST con JSON)</span>
      {url ? (
        <div className="flex gap-1">
          <input readOnly value={url} className={`${estiloInput} font-mono text-xs`} aria-label="URL del webhook" onFocus={(e) => e.target.select()} />
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin permiso */ } }} className={estilosBoton.icono} aria-label="Copiar URL">{copiado ? '✓' : <Copy className="size-4" />}</button>
          <button type="button" disabled={pendiente} onClick={() => confirm('La URL actual dejará de funcionar. ¿Renovarla?') && pedir(true)} className={estilosBoton.icono} aria-label="Renovar URL" title="Renovar"><RefreshCw className="size-4" /></button>
        </div>
      ) : <button type="button" disabled={pendiente} onClick={() => pedir(false)} className={estilosBoton.secundario}>Ver URL del webhook</button>}
      <p className="mt-2 text-xs text-tenue">Guárdala en secreto. Funciona cuando el flujo está publicado.</p>
    </div>
    <Aviso estado={r} />
    <p className="text-sm font-medium text-texto">¿Dónde vienen los datos del contacto en el JSON?</p>
    {([['campo_email', 'Correo', 'email'], ['campo_telefono', 'Teléfono', 'telefono'], ['campo_nombre', 'Nombre', 'nombre']] as const).map(([k, t, ph]) => (
      <label key={k} className="block"><span className={etiqueta}>{t}</span>
        <input value={String(filtro[k] ?? '')} onChange={(e) => alCambiar(k, e.target.value)} placeholder={ph} maxLength={120} className={`${estiloInput} font-mono text-xs`} /></label>
    ))}
    <p className="text-xs text-tenue">Usa puntos para datos anidados (p. ej. <code>cliente.email</code>). Todo el JSON queda disponible en los pasos como {'{{webhook.campo}}'}.</p>
  </>);
}
