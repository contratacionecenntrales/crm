'use client';
import { useActionState, useEffect, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { guardarCalendario } from '@/app/subcuenta/[id]/calendarios/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estiloTarjeta, estilosBoton } from '@/components/ui/clases';
import { DIAS_LARGOS } from '@/lib/calendario/tiempo';
import { COLORES_CALENDARIO, nombrePersona, type Calendario, type Franja } from '@/lib/calendario/tipos';
import type { Usuario } from '@/lib/crm/tipos';
import { BotonCopiar } from './TablaCalendarios';
import { POR_DEFECTO, VARIABLES, antelacionTexto, textoAviso } from '@/lib/calendario/avisos';

const UNIDADES = [['1', 'minutos'], ['60', 'horas'], ['1440', 'días']] as const;
const partirMinutos = (m: number): [number, string] => (m % 1440 === 0 ? [m / 1440, '1440'] : m % 60 === 0 ? [m / 60, '60'] : [m, '1']);
const EJEMPLO = { nombre: 'Marta', empresa: 'tu empresa', fecha: 'jueves, 5 de noviembre', hora: '10:00', enlace: 'https://…/cita/…' };

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';
const ayuda = 'mt-1 block text-xs text-tenue';
const PESTANAS = [
  ['detalles', 'Detalles de la reunión'],
  ['disponibilidad', 'Disponibilidad'],
  ['preferencias', 'Preferencias de reserva'],
  ['notificaciones', 'Notificaciones'],
  ['insertar', 'Enlace e inserción'],
] as const;
type Pestana = (typeof PESTANAS)[number][0];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // de lunes a domingo

function Numero({ name, texto, valor, min, max, sufijo, nota }: { name: string; texto: string; valor: number | null; min: number; max: number; sufijo: string; nota?: string }) {
  return (
    <label className="block">
      <span className={etiqueta}>{texto}</span>
      <span className="flex items-center gap-2">
        <input type="number" name={name} defaultValue={valor ?? ''} min={min} max={max} className={`${estiloInput} max-w-32`} />
        <span className="text-sm text-tenue">{sufijo}</span>
      </span>
      {nota && <span className={ayuda}>{nota}</span>}
    </label>
  );
}

export function EditorCalendario({ subId, calendario: c, horario, usuarios, origen }: {
  subId: string; calendario: Calendario; horario: Franja[]; usuarios: Usuario[]; origen: string;
}) {
  const [estado, accion] = useActionState(guardarCalendario.bind(null, subId, c.id), null);
  const [pestana, setPestana] = useState<Pestana>('detalles');
  const [tipo, setTipo] = useState(c.tipo);
  const [equipo, setEquipo] = useState<string[]>(c.equipo);
  const [color, setColor] = useState(c.color);
  const [slug, setSlug] = useState(c.slug);
  const [franjas, setFranjas] = useState<Franja[]>(horario);
  const [zonas, setZonas] = useState<string[]>([c.zona_horaria]);
  const [recordatorios, setRecordatorios] = useState<number[]>(c.recordatorios);
  const [plantillas, setPlantillas] = useState({ confirmacion: c.plantilla_confirmacion, recordatorio: c.plantilla_recordatorio });
  const [nombreCal, setNombreCal] = useState(c.nombre);
  useEffect(() => {
    try {
      const todas = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
      setZonas(todas.includes(c.zona_horaria) ? todas : [c.zona_horaria, ...todas]);
    } catch { /* navegador antiguo: se queda la actual */ }
  }, [c.zona_horaria]);
  // Si hay un error, se muestra la pestaña donde suele estar el campo.
  useEffect(() => {
    if (estado && !estado.ok && /franja|horario/i.test(estado.error ?? '')) setPestana('disponibilidad');
  }, [estado]);

  const marcarPersona = (id: string, on: boolean) => {
    if (tipo === 'personal') setEquipo(on ? [id] : []);
    else setEquipo((e) => (on ? [...e, id] : e.filter((x) => x !== id)));
  };
  const delDia = (d: number) => franjas.filter((f) => f.dia === d);
  const ponerDia = (d: number, lista: Franja[]) => setFranjas((fs) => [...fs.filter((f) => f.dia !== d), ...lista]);
  const copiarATodos = (d: number) => {
    const modelo = delDia(d);
    setFranjas(ORDEN_DIAS.flatMap((x) => (delDia(x).length || x === d ? modelo.map((f) => ({ ...f, dia: x })) : [])));
  };

  const enlace = `${origen}/reservar/${slug}`;
  const iframe = `<iframe src="${enlace}?incrustado=1" style="width:100%;min-height:760px;border:none;overflow:hidden" scrolling="no" title="Reservar cita"></iframe>`;

  return (
    <form action={accion} className={`${estiloTarjeta} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-full" style={{ background: color }} />
          <h2 className="text-lg font-semibold text-texto">{c.nombre}</h2>
        </div>
        <BotonEnvio>Guardar</BotonEnvio>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b px-3" aria-label="Secciones del calendario">
        {PESTANAS.map(([v, texto]) => (
          <button key={v} type="button" onClick={() => setPestana(v)} aria-current={pestana === v ? 'page' : undefined}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium ${pestana === v ? 'border-b-2 border-pestana text-pestana' : 'text-[var(--menu)] hover:text-pestana'}`}>
            {texto}
          </button>
        ))}
      </nav>

      <div className="space-y-5 p-5">
        <Aviso estado={estado} />

        {/* Las pestañas ocultas siguen dentro del formulario: todo se guarda a la vez. */}
        <section hidden={pestana !== 'detalles'} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className={etiqueta}>Nombre del calendario</span>
              <input name="nombre" value={nombreCal} onChange={(e) => setNombreCal(e.target.value)} required maxLength={120} className={estiloInput} />
            </label>
            <label className="block">
              <span className={etiqueta}>Enlace de reserva</span>
              <span className="flex items-center overflow-hidden rounded border border-borde-fuerte shadow-xs focus-within:border-primario">
                <span className="whitespace-nowrap bg-superficie-2 px-2.5 text-sm leading-8 text-tenue">/reservar/</span>
                <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  required minLength={3} maxLength={60} className="h-8 min-w-0 flex-1 bg-superficie px-2 text-sm text-texto focus:outline-none" />
              </span>
            </label>
          </div>
          <label className="block">
            <span className={etiqueta}>Descripción</span>
            <textarea name="descripcion" defaultValue={c.descripcion} rows={3} maxLength={2000} className={estiloArea}
              placeholder="Lo que verá el cliente en la página de reserva" />
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className={etiqueta}>Ubicación</span>
              <input name="ubicacion" defaultValue={c.ubicacion} maxLength={500} className={estiloInput} placeholder="Dirección, enlace de videollamada o «Te llamamos»" />
            </label>
            <div>
              <span className={etiqueta}>Color</span>
              <input type="hidden" name="color" value={color} />
              <div className="flex flex-wrap items-center gap-2">
                {COLORES_CALENDARIO.map((x) => (
                  <button key={x} type="button" onClick={() => setColor(x)} aria-label={`Color ${x}`} aria-pressed={color === x}
                    className={`size-7 rounded-full ring-offset-2 ${color === x ? 'ring-2 ring-primario' : ''}`} style={{ background: x }} />
                ))}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Otro color" className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" />
              </div>
            </div>
          </div>
          <fieldset>
            <legend className={etiqueta}>Tipo de calendario</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {([['personal', 'Personal', 'Las citas son siempre con la misma persona.'],
                ['ronda', 'Por turnos (round robin)', 'Las reservas se reparten entre el equipo: se asigna a quien esté libre y tenga menos citas ese día.']] as const).map(([v, t, d]) => (
                <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${tipo === v ? 'border-primario bg-primario-suave' : 'border-borde-fuerte'}`}>
                  <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => { setTipo(v); if (v === 'personal') setEquipo((e) => e.slice(0, 1)); }} className="mt-0.5 size-4 accent-primario" />
                  <span><span className="block text-sm font-medium text-texto">{t}</span><span className="block text-xs text-tenue">{d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={etiqueta}>{tipo === 'personal' ? 'Persona que atiende' : 'Equipo que atiende'}</legend>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {usuarios.map((u) => (
                <label key={u.usuario_id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-borde-fuerte px-3 py-2 text-sm">
                  <input type={tipo === 'personal' ? 'radio' : 'checkbox'} name="equipo" value={u.usuario_id} checked={equipo.includes(u.usuario_id)}
                    onChange={(e) => marcarPersona(u.usuario_id, e.target.checked)} className="size-4 accent-primario" />
                  <span className="min-w-0"><span className="block truncate text-texto">{nombrePersona(u)}</span><span className="block truncate text-xs text-tenue">{u.email}</span></span>
                </label>
              ))}
            </div>
            <span className={ayuda}>Sin nadie asignado, el calendario funciona como una sola agenda y las citas quedan sin asignar.</span>
          </fieldset>
        </section>

        <section hidden={pestana !== 'disponibilidad'} className="space-y-4">
          <input type="hidden" name="franjas" value={JSON.stringify(franjas)} />
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className={etiqueta}>Zona horaria del horario</span>
              <select name="zona_horaria" defaultValue={c.zona_horaria} key={zonas.length} className={estiloInput}>
                {zonas.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
          </div>
          <div className="divide-y rounded-lg border border-borde-fuerte">
            {ORDEN_DIAS.map((d) => {
              const lista = delDia(d);
              const abierto = lista.length > 0;
              return (
                <div key={d} className="flex flex-wrap items-start gap-4 px-4 py-3">
                  <label className="flex w-36 items-center gap-2 pt-1 text-sm font-medium capitalize text-texto">
                    <input type="checkbox" checked={abierto} className="size-4 accent-primario"
                      onChange={(e) => ponerDia(d, e.target.checked ? [{ dia: d, inicio: '09:00', fin: '17:00' }] : [])} />
                    {DIAS_LARGOS[d]}
                  </label>
                  <div className="flex-1 space-y-2">
                    {!abierto && <p className="pt-1 text-sm text-tenue">No disponible</p>}
                    {lista.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" value={f.inicio} aria-label="Desde" className={`${estiloInput} w-32`}
                          onChange={(e) => ponerDia(d, lista.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} />
                        <span className="text-tenue">–</span>
                        <input type="time" value={f.fin === '24:00' ? '23:59' : f.fin} aria-label="Hasta" className={`${estiloInput} w-32`}
                          onChange={(e) => ponerDia(d, lista.map((x, j) => (j === i ? { ...x, fin: e.target.value } : x)))} />
                        <button type="button" aria-label="Quitar franja" onClick={() => ponerDia(d, lista.filter((_, j) => j !== i))}
                          className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" title="Añadir franja" aria-label="Añadir franja"
                      onClick={() => ponerDia(d, [...lista, lista.length ? { dia: d, inicio: lista[lista.length - 1].fin < '23:00' ? lista[lista.length - 1].fin : '18:00', fin: '23:59' } : { dia: d, inicio: '09:00', fin: '17:00' }])}
                      className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto"><Plus className="size-4" /></button>
                    {abierto && (
                      <button type="button" title="Copiar este horario a los días abiertos" aria-label="Copiar a los demás días" onClick={() => copiarATodos(d)}
                        className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto"><Copy className="size-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-tenue">Las franjas bloqueadas y las citas ya reservadas se descuentan solas de estas horas.</p>
        </section>

        <section hidden={pestana !== 'preferencias'} className="grid gap-5 md:grid-cols-2">
          <Numero name="duracion_min" texto="Duración de la cita" valor={c.duracion_min} min={5} max={480} sufijo="minutos" />
          <Numero name="intervalo_min" texto="Intervalo entre horas de inicio" valor={c.intervalo_min} min={5} max={480} sufijo="minutos"
            nota="Cada cuánto empieza una hora libre: con 15, se ofrece 9:00, 9:15, 9:30…" />
          <Numero name="antelacion_min" texto="Antelación mínima" valor={c.antelacion_min} min={0} max={43200} sufijo="minutos"
            nota="Nadie podrá reservar con menos tiempo del indicado." />
          <Numero name="dias_reserva" texto="Ventana de reserva" valor={c.dias_reserva} min={1} max={365} sufijo="días"
            nota="Hasta cuántos días en el futuro se puede reservar." />
          <Numero name="margen_antes" texto="Margen antes de cada cita" valor={c.margen_antes} min={0} max={240} sufijo="minutos" />
          <Numero name="margen_despues" texto="Margen después de cada cita" valor={c.margen_despues} min={0} max={240} sufijo="minutos" />
          <Numero name="max_por_dia" texto="Máximo de citas al día" valor={c.max_por_dia} min={1} max={500} sufijo="citas" nota="Vacío = sin límite." />
          <label className="block md:col-span-2">
            <span className={etiqueta}>Mensaje de confirmación</span>
            <textarea name="confirmacion" defaultValue={c.confirmacion} rows={3} maxLength={1000} className={estiloArea}
              placeholder="Lo que verá el cliente al terminar la reserva. Ej.: «Te esperamos. Si no puedes venir, llámanos.»" />
          </label>
        </section>

        <section hidden={pestana !== 'notificaciones'} className="space-y-6">
          <input type="hidden" name="recordatorios" value={JSON.stringify(recordatorios)} />
          <fieldset>
            <legend className={etiqueta}>Canales por los que se avisa al contacto</legend>
            <div className="flex flex-wrap gap-2">
              {([['email', 'Correo'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp']] as const).map(([v, t]) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-borde-fuerte px-3 py-2 text-sm">
                  <input type="checkbox" name="avisos_canales" value={v} defaultChecked={c.avisos_canales.includes(v)} className="size-4 accent-primario" /> {t}
                </label>
              ))}
            </div>
            <span className={ayuda}>Se envían desde Conversaciones con la cuenta configurada en Integración telefónica y Servicios de correo, y quedan en el historial del contacto.</span>
          </fieldset>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="aviso_confirmacion" defaultChecked={c.aviso_confirmacion} className="mt-0.5 size-4 accent-primario" />
              <span><span className="block font-medium text-texto">Confirmación al reservar</span><span className="text-tenue">En cuanto se crea la cita. Los cambios de hora y las cancelaciones se avisan siempre.</span></span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="permitir_cancelar" defaultChecked={c.permitir_cancelar} className="mt-0.5 size-4 accent-primario" />
              <span><span className="block font-medium text-texto">El cliente puede cancelar desde el enlace</span><span className="text-tenue">El enlace de los avisos abre una página con la cita y el botón «Cancelar mi cita».</span></span>
            </label>
          </div>
          <div>
            <span className={etiqueta}>Recordatorios</span>
            <div className="space-y-2">
              {recordatorios.length === 0 && <p className="text-sm text-tenue">Sin recordatorios.</p>}
              {recordatorios.map((m, i) => {
                const [n, u] = partirMinutos(m);
                const poner = (nn: number, uu: string) => setRecordatorios((l) => l.map((x, j) => (j === i ? Math.max(1, nn) * Number(uu) : x)));
                return (
                  <div key={i} className="flex items-center gap-2">
                    <input type="number" min={1} value={n} onChange={(e) => poner(Number(e.target.value) || 1, u)} aria-label="Cantidad" className={`${estiloInput} w-24`} />
                    <select value={u} onChange={(e) => poner(n, e.target.value)} aria-label="Unidad" className={`${estiloInput} w-32`}>
                      {UNIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <span className="text-sm text-tenue">antes de la cita</span>
                    <button type="button" aria-label="Quitar recordatorio" onClick={() => setRecordatorios((l) => l.filter((_, j) => j !== i))}
                      className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"><Trash2 className="size-4" /></button>
                  </div>
                );
              })}
            </div>
            {recordatorios.length < 5 && (
              <button type="button" onClick={() => setRecordatorios((l) => [...l, l.includes(60) ? 120 : 60])} className={`${estilosBoton.fantasma} mt-2 text-primario-texto`}>
                <Plus className="size-4" /> Añadir recordatorio
              </button>
            )}
            {recordatorios.length > 0 && <span className={ayuda}>Se enviarán: {[...recordatorios].sort((a, b) => b - a).map(antelacionTexto).join(', ')}.</span>}
          </div>
          {(['confirmacion', 'recordatorio'] as const).map((tipo) => (
            <div key={tipo} className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className={etiqueta}>Texto de {tipo === 'confirmacion' ? 'la confirmación' : 'los recordatorios'}</span>
                <textarea name={`plantilla_${tipo}`} rows={5} maxLength={1600} value={plantillas[tipo]} placeholder={POR_DEFECTO[tipo]}
                  onChange={(e) => setPlantillas((p) => ({ ...p, [tipo]: e.target.value }))} className={estiloArea} />
                <span className={ayuda}>Vacío = el texto de ejemplo. Variables: {VARIABLES.map((v) => `{{${v.clave}}}`).join(' ')}</span>
              </label>
              <div>
                <span className={etiqueta}>Vista previa</span>
                <p className="whitespace-pre-wrap rounded-lg bg-[#eff4ff] px-3 py-2 text-sm text-[#101828] dark:text-texto">
                  {textoAviso(tipo, plantillas, { ...EJEMPLO, calendario: nombreCal || 'Calendario', ubicacion: c.ubicacion }).cuerpo}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section hidden={pestana !== 'insertar'} className="space-y-5">
          <div>
            <span className={etiqueta}>Enlace para compartir</span>
            <div className="flex items-center gap-2">
              <input readOnly value={enlace} className={estiloInput} onFocus={(e) => e.target.select()} />
              <BotonCopiar texto={enlace} />
              <a href={enlace} target="_blank" rel="noreferrer" className={estilosBoton.secundario}>Abrir</a>
            </div>
            {slug !== c.slug && <span className={ayuda}>Guarda para que el enlace nuevo funcione.</span>}
          </div>
          <div>
            <span className={etiqueta}>Código para insertar en tu web</span>
            <div className="flex items-start gap-2">
              <textarea readOnly value={iframe} rows={3} className={`${estiloArea} font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <BotonCopiar texto={iframe} etiqueta="Copiar código" />
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
