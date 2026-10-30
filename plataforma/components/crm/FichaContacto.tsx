'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { ArrowLeft, Mail, MessageSquare, Phone, Plus, Trash2, X } from 'lucide-react';
import {
  actualizarContacto, borrarContacto, borrarNota, cambiarDnd, cambiarEtiquetas, cambiarPropietario, crearNota, editarNota,
} from '@/app/subcuenta/[id]/contactos/acciones';
import { Avatar } from '@/components/ui/Avatar';
import { Aviso } from '@/components/ui/Aviso';
import { Modal } from '@/components/ui/Modal';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { FormularioContacto } from './FormularioContacto';
import { FormularioOportunidad } from './FormularioOportunidad';
import { FilaTarea, FormularioTarea } from './Tareas';
import { dinero, haceCuanto } from '@/lib/formato';
import { nombreContacto, type Campo, type Contacto, type Embudo, type Evento, type Nota, type Oportunidad, type Tarea, type Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';
import { ESTADOS_CITA, estadoCita, type Cita } from '@/lib/calendario/tipos';

interface Props {
  subId: string;
  contacto: Contacto;
  campos: Campo[];
  asignables: Usuario[];
  etiquetas: string[];
  notas: Nota[];
  tareas: Tarea[];
  oportunidades: (Oportunidad & { etapa?: { nombre: string } | null })[];
  eventos: Evento[];
  citas: Cita[];
  calendarios: { id: string; nombre: string; color: string }[];
  embudos: Embudo[];
  moneda: string;
  zona: string;
  yo: string;
  soyAdmin: boolean;
}

const CANALES = [['email', 'Correo'], ['sms', 'SMS'], ['llamada', 'Llamadas'], ['whatsapp', 'WhatsApp']] as const;
const TONO_ESTADO = { abierta: 'azul', ganada: 'verde', perdida: 'rojo', abandonada: 'gris' } as const;

export function FichaContacto(p: Props) {
  const c = p.contacto;
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [lateral, setLateral] = useState<'campos' | 'dnd' | 'acciones'>('campos');
  const [principal, setPrincipal] = useState<'actividad' | 'notas' | 'tareas' | 'oportunidades' | 'citas'>('actividad');
  const [dialogo, setDialogo] = useState<null | { tipo: 'tarea'; t?: Tarea } | { tipo: 'oportunidad'; o?: Oportunidad }>(null);
  const cerrar = useCallback(() => setDialogo(null), []);
  const nombre = nombreContacto(c);
  const usuario = (id: string | null) => {
    const u = p.asignables.find((x) => x.usuario_id === id);
    return u ? u.nombre || u.email : 'Alguien';
  };
  const ejecutar = (fn: () => Promise<Resultado>) => iniciar(async () => setAviso(await fn()));

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <Link href={`/subcuenta/${p.subId}/contactos`} className="mb-3 inline-flex items-center gap-1 text-sm text-tenue hover:text-texto">
        <ArrowLeft className="size-4" /> Contactos
      </Link>
      {aviso && !aviso.ok && <div className="mb-3"><Aviso estado={aviso} /></div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[26rem_1fr]">
        {/* Detalles de contacto */}
        <aside className="rounded-lg border border-borde bg-superficie">
          <div className="space-y-4 border-b p-4">
            <div className="flex items-center gap-3">
              <Avatar nombre={nombre} tam="size-12" suave />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{nombre}</h1>
                <p className="flex flex-wrap gap-x-3 text-sm text-tenue">
                  {c.telefono && <a href={`tel:${c.telefono}`} className="flex items-center gap-1 hover:text-primario"><Phone className="size-3.5" />{c.telefono}</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 truncate hover:text-primario"><Mail className="size-3.5" />{c.email}</a>}
                  <Link href={`/subcuenta/${p.subId}/conversaciones?contacto=${c.id}`} className="flex items-center gap-1 font-medium text-primario hover:underline"><MessageSquare className="size-3.5" />Enviar mensaje</Link>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm">Propietario</span>
                <select defaultValue={c.propietario_id ?? ''} disabled={pendiente} className={`${estiloInput} py-1.5`}
                  onChange={(e) => ejecutar(() => cambiarPropietario(p.subId, c.id, e.target.value || null))}>
                  <option value="">Sin asignar</option>
                  {p.asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
                </select>
              </label>
              <div>
                <span className="mb-1 block text-sm">Tipo</span>
                <Insignia tono={c.tipo === 'cliente' ? 'verde' : 'azul'}>{c.tipo === 'cliente' ? 'Cliente' : 'Lead'}</Insignia>
              </div>
            </div>
            <EditorEtiquetas
              actuales={c.etiquetas}
              catalogo={p.etiquetas}
              alCambiar={(lista) => ejecutar(() => cambiarEtiquetas(p.subId, c.id, lista))}
            />
          </div>

          <div className="flex border-b text-sm">
            {([['campos', 'Todos los campos'], ['dnd', 'DND'], ['acciones', 'Acciones']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setLateral(k)} className={`flex-1 border-r px-3 py-2.5 last:border-r-0 ${lateral === k ? 'bg-superficie-2 font-medium' : 'text-tenue'}`}>{t}</button>
            ))}
          </div>
          <div className="p-4">
            {lateral === 'campos' && (
              <FormularioContacto
                accion={actualizarContacto.bind(null, p.subId, c.id)}
                campos={p.campos}
                asignables={p.asignables}
                contacto={c}
                compacto
                alGuardar={() => router.refresh()}
              />
            )}
            {lateral === 'dnd' && (
              <Dnd dnd={c.dnd} canales={c.dnd_canales} pendiente={pendiente}
                alGuardar={(d, cs) => ejecutar(() => cambiarDnd(p.subId, c.id, d, cs))} />
            )}
            {lateral === 'acciones' && (
              <div className="space-y-3 text-sm">
                <p className="text-tenue" suppressHydrationWarning>Creado {haceCuanto(c.creado)} · Última actividad {c.ultima_actividad ? haceCuanto(c.ultima_actividad) : 'ninguna'}</p>
                {p.soyAdmin ? (
                  <button disabled={pendiente} className={estilosBoton.peligro}
                    onClick={() => confirm(`¿Eliminar a ${nombre}? Se borran también sus notas, tareas y oportunidades.`) &&
                      iniciar(async () => {
                        const r = await borrarContacto(p.subId, c.id);
                        if (r.ok) router.push(`/subcuenta/${p.subId}/contactos`);
                        else setAviso(r);
                      })}>
                    <Trash2 className="size-4" /> Eliminar contacto
                  </button>
                ) : (
                  <p className="text-tenue">Solo un administrador puede eliminar contactos.</p>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Actividad, notas, tareas y oportunidades */}
        <section className="min-w-0 rounded-lg border border-borde bg-superficie">
          <div className="flex gap-6 overflow-x-auto border-b px-4">
            {([['actividad', 'Actividad'], ['notas', `Notas (${p.notas.length})`], ['tareas', `Tareas (${p.tareas.filter((t) => !t.completada).length})`],
              ['oportunidades', `Oportunidades (${p.oportunidades.length})`], ['citas', `Citas (${p.citas.length})`]] as const).map(([k, t]) => (
              <button key={k} onClick={() => setPrincipal(k)}
                className={`-mb-px shrink-0 border-b-2 py-3 text-sm font-medium ${principal === k ? 'border-primario text-primario' : 'border-transparent text-tenue'}`}>{t}</button>
            ))}
          </div>

          {principal === 'actividad' && (
            <ol className="relative space-y-4 p-5 before:absolute before:bottom-5 before:left-[1.65rem] before:top-5 before:w-px before:bg-[var(--borde)]">
              {p.eventos.length === 0 && <li className="text-sm text-tenue">Sin actividad.</li>}
              {p.eventos.map((e) => (
                <li key={e.id} className="relative flex gap-3 pl-1">
                  <span className="z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-primario bg-superficie" />
                  <div className="text-sm">
                    <p>{textoEvento(e, p.moneda, p.zona)}</p>
                    <p className="text-xs text-tenue" suppressHydrationWarning>{usuario(e.actor_id)} · {haceCuanto(e.ts)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {principal === 'notas' && (
            <Notas subId={p.subId} contactoId={c.id} notas={p.notas} yo={p.yo} soyAdmin={p.soyAdmin} autor={usuario} />
          )}

          {principal === 'tareas' && (
            <div>
              <div className="flex justify-end p-3"><button className={estilosBoton.primario} onClick={() => setDialogo({ tipo: 'tarea' })}><Plus className="size-4" /> Nueva tarea</button></div>
              <ul className="divide-y border-t">
                {p.tareas.length === 0 && <li className="px-4 py-8 text-center text-sm text-tenue">Sin tareas.</li>}
                {p.tareas.map((t) => <FilaTarea key={t.id} subId={p.subId} t={t} asignables={p.asignables} zona={p.zona} alEditar={(x) => setDialogo({ tipo: 'tarea', t: x })} />)}
              </ul>
            </div>
          )}

          {principal === 'citas' && (
            <div>
              <div className="flex justify-end p-3">
                <Link className={estilosBoton.primario} href={`/subcuenta/${p.subId}/calendarios?nuevo=1&contacto=${c.id}`}><Plus className="size-4" /> Reservar cita</Link>
              </div>
              <ul className="divide-y border-t">
                {p.citas.length === 0 && <li className="px-4 py-8 text-center text-sm text-tenue">Sin citas.</li>}
                {p.citas.map((x) => {
                  const cal = p.calendarios.find((k) => k.id === x.calendario_id);
                  const e = estadoCita(x.estado);
                  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: p.zona }).format(new Date(x.inicio));
                  return (
                    <li key={x.id}>
                      <Link href={`/subcuenta/${p.subId}/calendarios?vista=semana&fecha=${dia}&cita=${x.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-superficie-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: cal?.color ?? '#98a2b3' }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{x.titulo}</span>
                          <span className="text-xs text-tenue">
                            {new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short', timeZone: p.zona }).format(new Date(x.inicio))} · {cal?.nombre}
                          </span>
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.clase}`}>{e.texto}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {principal === 'oportunidades' && (
            <div>
              <div className="flex justify-end p-3"><button className={estilosBoton.primario} onClick={() => setDialogo({ tipo: 'oportunidad' })}><Plus className="size-4" /> Nueva oportunidad</button></div>
              <ul className="divide-y border-t">
                {p.oportunidades.length === 0 && <li className="px-4 py-8 text-center text-sm text-tenue">Sin oportunidades.</li>}
                {p.oportunidades.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => setDialogo({ tipo: 'oportunidad', o })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{o.nombre}</span>
                        <span className="text-xs text-tenue">{p.embudos.find((e) => e.id === o.embudo_id)?.nombre} · {o.etapa?.nombre}</span>
                      </span>
                      <Insignia tono={TONO_ESTADO[o.estado]}>{o.estado}</Insignia>
                      <span className="font-medium">{dinero(o.valor, p.moneda)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <Modal abierto={dialogo?.tipo === 'tarea'} alCerrar={cerrar} titulo={dialogo?.tipo === 'tarea' && dialogo.t ? 'Editar tarea' : 'Nueva tarea'}>
        {dialogo?.tipo === 'tarea' && (
          <FormularioTarea subId={p.subId} tarea={dialogo.t} contactoFijo={c.id} asignables={p.asignables} yo={p.yo} alGuardar={cerrar} />
        )}
      </Modal>
      <Modal abierto={dialogo?.tipo === 'oportunidad'} alCerrar={cerrar} titulo={dialogo?.tipo === 'oportunidad' && dialogo.o ? 'Editar oportunidad' : 'Nueva oportunidad'} ancho="max-w-2xl">
        {dialogo?.tipo === 'oportunidad' && (
          <FormularioOportunidad subId={p.subId} embudos={p.embudos} asignables={p.asignables} oportunidad={dialogo.o} contactoFijo={c}
            moneda={p.moneda} alGuardar={cerrar} />
        )}
      </Modal>
    </div>
  );
}

const ESTADO_TEXTO: Record<string, string> = Object.fromEntries(ESTADOS_CITA.map((x) => [x.valor, x.texto.toLowerCase()]));

function textoEvento(e: Evento, moneda: string, zona: string): string {
  const d = e.detalle as Record<string, unknown>;
  const fechaCita = (v: unknown) => typeof v === 'string'
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: zona }).format(new Date(v)) : '';
  switch (e.tipo) {
    case 'contacto_creado': return 'Contacto creado';
    case 'etiquetas': {
      const a = (d['añadidas'] as string[]) ?? [];
      const q = (d.quitadas as string[]) ?? [];
      return [a.length ? `Etiquetas añadidas: ${a.join(', ')}` : '', q.length ? `Etiquetas quitadas: ${q.join(', ')}` : ''].filter(Boolean).join(' · ');
    }
    case 'dnd_activado': return 'No molestar activado';
    case 'dnd_desactivado': return 'No molestar desactivado';
    case 'propietario': return 'Propietario cambiado';
    case 'nota': return `Nota: ${d.extracto ?? ''}`;
    case 'tarea_creada': return `Tarea creada: ${d.titulo ?? ''}`;
    case 'tarea_completada': return `Tarea completada: ${d.titulo ?? ''}`;
    case 'oportunidad_creada': return `Oportunidad creada: ${d.nombre} (${dinero(Number(d.valor ?? 0), moneda)}) en ${d.etapa}`;
    case 'oportunidad_etapa': return `Oportunidad «${d.nombre}» movida a ${d.etapa}`;
    case 'cita_creada': return `Cita ${d.origen === 'reserva' ? 'reservada online' : 'creada'}: ${d.titulo ?? ''} (${fechaCita(d.inicio)}) en ${d.calendario ?? ''}`;
    case 'cita_movida': return `Cita movida: ${d.titulo ?? ''} → ${fechaCita(d.inicio)}`;
    case 'cita_estado': return `Cita «${d.titulo ?? ''}» marcada como ${ESTADO_TEXTO[String(d.estado)] ?? d.estado}`;
    case 'oportunidad_estado': return `Oportunidad «${d.nombre}» marcada como ${d.estado}`;
    default: return e.tipo;
  }
}

function EditorEtiquetas({ actuales, catalogo, alCambiar }: { actuales: string[]; catalogo: string[]; alCambiar: (l: string[]) => void }) {
  const [lista, setLista] = useState(actuales);
  const [nueva, setNueva] = useState('');
  const [abierto, setAbierto] = useState(false);
  const aplicar = (l: string[]) => {
    setLista(l);
    alCambiar(l);
  };
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        Etiquetas ({lista.length})
        <button onClick={() => setAbierto((v) => !v)} aria-label="Añadir etiqueta" className="text-primario"><Plus className="size-4 rounded-full border border-primario" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-md border bg-superficie-2 px-2 py-0.5 text-sm">
            {e}
            <button onClick={() => aplicar(lista.filter((x) => x !== e))} aria-label={`Quitar ${e}`} className="text-tenue hover:text-peligro"><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      {abierto && (
        <form className="mt-2 flex gap-2" onSubmit={(ev) => {
          ev.preventDefault();
          const v = nueva.trim();
          if (v && !lista.includes(v)) aplicar([...lista, v]);
          setNueva('');
        }}>
          <input list="catalogo-etiquetas" value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={60} autoFocus className={`${estiloInput} py-1.5`} placeholder="Nueva etiqueta" />
          <datalist id="catalogo-etiquetas">{catalogo.filter((x) => !lista.includes(x)).map((x) => <option key={x} value={x} />)}</datalist>
          <button className={`${estilosBoton.primario} py-1.5`}>Añadir</button>
        </form>
      )}
    </div>
  );
}

function Dnd({ dnd, canales, alGuardar, pendiente }: { dnd: boolean; canales: string[]; alGuardar: (d: boolean, c: string[]) => void; pendiente: boolean }) {
  const [todo, setTodo] = useState(dnd);
  const [lista, setLista] = useState(canales);
  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span><span className="block font-medium">No molestar en ningún canal</span><span className="text-tenue">Bloquea correos, SMS, llamadas y WhatsApp a este contacto.</span></span>
        <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} className="size-5" />
      </label>
      {!todo && (
        <fieldset className="space-y-2">
          <legend className="mb-1 font-medium">O solo en estos canales</legend>
          {CANALES.map(([k, t]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={lista.includes(k)} className="size-4"
                onChange={(e) => setLista((l) => (e.target.checked ? [...l, k] : l.filter((x) => x !== k)))} />
              {t}
            </label>
          ))}
        </fieldset>
      )}
      <button disabled={pendiente} onClick={() => alGuardar(todo, lista)} className={estilosBoton.primario}>Guardar</button>
    </div>
  );
}

function Notas({ subId, contactoId, notas, yo, soyAdmin, autor }: {
  subId: string; contactoId: string; notas: Nota[]; yo: string; soyAdmin: boolean; autor: (id: string | null) => string;
}) {
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();
  const ejecutar = (fn: () => Promise<Resultado>, despues?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      setError(r.ok ? '' : r.error);
      if (r.ok) despues?.();
    });
  return (
    <div className="space-y-4 p-4">
      <form onSubmit={(e) => { e.preventDefault(); ejecutar(() => crearNota(subId, contactoId, texto), () => setTexto('')); }} className="space-y-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={10000} placeholder="Escribe una nota…" className={estiloInput} />
        <div className="flex justify-end"><button disabled={pendiente || !texto.trim()} className={estilosBoton.primario}>Añadir nota</button></div>
      </form>
      {error && <p className="text-sm text-peligro">{error}</p>}
      <ul className="space-y-3">
        {notas.map((n) => {
          const puede = n.autor_id === yo || soyAdmin;
          return (
            <li key={n.id} className="rounded-lg border bg-amber-50/60 p-3 dark:bg-amber-950/20">
              {editando?.id === n.id ? (
                <div className="space-y-2">
                  <textarea value={editando.texto} onChange={(e) => setEditando({ id: n.id, texto: e.target.value })} rows={3} className={estiloInput} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditando(null)} className={estilosBoton.secundario}>Cancelar</button>
                    <button disabled={pendiente} onClick={() => ejecutar(() => editarNota(subId, n.id, editando.texto), () => setEditando(null))} className={estilosBoton.primario}>Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{n.cuerpo}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-tenue">
                    <span suppressHydrationWarning>{autor(n.autor_id)} · {haceCuanto(n.creado)}{n.actualizado !== n.creado && ' · editada'}</span>
                    {puede && (
                      <>
                        <button onClick={() => setEditando({ id: n.id, texto: n.cuerpo })} className="hover:text-texto">Editar</button>
                        <button onClick={() => confirm('¿Borrar la nota?') && ejecutar(() => borrarNota(subId, n.id))} className="hover:text-peligro">Borrar</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
