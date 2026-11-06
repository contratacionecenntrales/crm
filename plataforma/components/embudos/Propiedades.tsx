'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { nuevoId, type Bloque, type CampoFormulario, type Contenido, type Seccion, type Visual } from '@/lib/embudos/tipos';
import { ICONOS } from './Renderizado';

// Panel de propiedades del editor de embudos y bloques nuevos por defecto.

export type TipoBloque = Bloque['tipo'];
export interface Imagen { id: string; nombre: string; url: string }
export interface Calendario { nombre: string; slug: string; activo: boolean }

export const CATALOGO: { tipo: TipoBloque; nombre: string; grupo: 'Secciones' | 'Texto' | 'Medios' | 'Conversión' | 'Diseño' }[] = [
  { tipo: 'hero', nombre: 'Portada (hero)', grupo: 'Secciones' },
  { tipo: 'caracteristicas', nombre: 'Ventajas', grupo: 'Secciones' },
  { tipo: 'imagen_texto', nombre: 'Imagen y texto', grupo: 'Secciones' },
  { tipo: 'cifras', nombre: 'Cifras', grupo: 'Secciones' },
  { tipo: 'testimonios', nombre: 'Testimonios', grupo: 'Secciones' },
  { tipo: 'planes', nombre: 'Tabla de precios', grupo: 'Secciones' },
  { tipo: 'pasos', nombre: 'Cómo funciona', grupo: 'Secciones' },
  { tipo: 'preguntas', nombre: 'Preguntas frecuentes', grupo: 'Secciones' },
  { tipo: 'logos', nombre: 'Logos de clientes', grupo: 'Secciones' },
  { tipo: 'llamada', nombre: 'Llamada a la acción', grupo: 'Secciones' },
  { tipo: 'galeria', nombre: 'Galería', grupo: 'Medios' },
  { tipo: 'titulo', nombre: 'Titular', grupo: 'Texto' },
  { tipo: 'texto', nombre: 'Párrafo', grupo: 'Texto' },
  { tipo: 'lista', nombre: 'Lista', grupo: 'Texto' },
  { tipo: 'testimonio', nombre: 'Testimonio', grupo: 'Texto' },
  { tipo: 'imagen', nombre: 'Imagen', grupo: 'Medios' },
  { tipo: 'video', nombre: 'Vídeo', grupo: 'Medios' },
  { tipo: 'boton', nombre: 'Botón', grupo: 'Conversión' },
  { tipo: 'formulario', nombre: 'Formulario', grupo: 'Conversión' },
  { tipo: 'calendario', nombre: 'Calendario de citas', grupo: 'Conversión' },
  { tipo: 'precio', nombre: 'Tarjeta de precio', grupo: 'Conversión' },
  { tipo: 'cuenta_atras', nombre: 'Cuenta atrás', grupo: 'Conversión' },
  { tipo: 'separador', nombre: 'Separador', grupo: 'Diseño' },
];

export function bloqueNuevo(tipo: TipoBloque): Bloque {
  const id = nuevoId();
  switch (tipo) {
    case 'titulo': return { id, tipo, texto: 'Escribe un titular que enganche', nivel: 2, alineacion: 'centro' };
    case 'texto': return { id, tipo, texto: 'Escribe aquí tu texto. Explica el beneficio principal en una o dos frases.', alineacion: 'centro', tamano: 'normal' };
    case 'imagen': return { id, tipo, url: '', alt: '', ancho: 'completo', redondeada: true };
    case 'boton': return { id, tipo, texto: 'Quiero empezar', accion: 'siguiente', url: '', alineacion: 'centro', tamano: 'grande' };
    case 'video': return { id, tipo, url: '' };
    case 'formulario': return { id, tipo, campos: [{ clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }, { clave: 'email', etiqueta: 'Correo electrónico', tipo: 'email', obligatorio: true }], boton: 'Enviar', etiquetas: [], despues: 'siguiente', url: '', mensaje: '¡Gracias! Te escribimos en breve.', aviso_legal: 'Al enviar aceptas nuestra política de privacidad.' };
    case 'lista': return { id, tipo, elementos: ['Primer beneficio', 'Segundo beneficio', 'Tercer beneficio'], icono: 'check' };
    case 'testimonio': return { id, tipo, cita: 'Desde que trabajamos juntos hemos duplicado las ventas.', autor: 'Laura Gómez', cargo: 'Directora, Estudio Luz', foto: '' };
    case 'precio': return { id, tipo, titulo: 'Plan Pro', precio: '49 €', periodo: '/mes', caracteristicas: ['Todo lo esencial', 'Soporte prioritario', 'Sin permanencia'], boton: 'Empezar', accion: 'siguiente', url: '', destacado: false };
    case 'cuenta_atras': return { id, tipo, hasta: new Date(Date.now() + 7 * 864e5).toISOString(), texto_fin: '¡Ya ha empezado!' };
    case 'calendario': return { id, tipo, slug: '', alto: 760 };
    case 'separador': return { id, tipo, estilo: 'espacio', alto: 32 };
    case 'hero': return { id, tipo, etiqueta: 'Nuevo', titulo: 'Un titular que *vende* en una frase', subtitulo: 'Explica en dos líneas qué consigue tu cliente y por qué tú.', prueba: 'Valorado 4,9 por +500 clientes', disposicion: 'dividido', visual: 'tarjetas', imagen: '', boton_texto: 'Empezar ahora', boton_accion: 'siguiente', boton_url: '', boton2_texto: 'Ver cómo funciona', boton2_accion: 'ancla', boton2_url: '' };
    case 'caracteristicas': return { id, tipo, titulo: 'Todo lo que necesitas', subtitulo: 'Sin complicaciones ni letra pequeña.', columnas: 3, estilo: 'tarjetas', items: [
      { icono: 'rayo', titulo: 'Rápido', texto: 'Resultados desde la primera semana.' }, { icono: 'escudo', titulo: 'Seguro', texto: 'Tus datos protegidos en todo momento.' }, { icono: 'chat', titulo: 'Cercano', texto: 'Te atendemos cuando lo necesitas.' }] };
    case 'imagen_texto': return { id, tipo, etiqueta: 'Por qué nosotros', titulo: 'Un beneficio claro y concreto', texto: 'Cuenta cómo lo consigues y qué cambia para tu cliente.', puntos: ['Primer punto fuerte', 'Segundo punto fuerte', 'Tercer punto fuerte'], visual: 'panel', imagen: '', invertir: false, boton_texto: '', boton_accion: 'siguiente', boton_url: '' };
    case 'cifras': return { id, tipo, items: [{ valor: '+2.000', etiqueta: 'clientes' }, { valor: '4,9★', etiqueta: 'valoración media' }, { valor: '24 h', etiqueta: 'tiempo de respuesta' }, { valor: '98 %', etiqueta: 'repiten' }] };
    case 'testimonios': return { id, tipo, titulo: 'Lo que dicen nuestros clientes', items: [
      { cita: 'El mejor servicio que hemos contratado. Se nota la experiencia.', autor: 'Laura Gómez', cargo: 'Directora, Estudio Luz', foto: '', estrellas: 5 },
      { cita: 'Rápidos, claros y con resultados desde el primer mes.', autor: 'Carlos Ruiz', cargo: 'Fundador, Ruiz & Co.', foto: '', estrellas: 5 },
      { cita: 'Me resolvieron en un día lo que llevaba meses arrastrando.', autor: 'Marta Pérez', cargo: 'Autónoma', foto: '', estrellas: 5 }] };
    case 'planes': return { id, tipo, titulo: 'Planes sencillos', subtitulo: 'Sin permanencia. Cambia cuando quieras.', accion: 'siguiente', url: '', items: [
      { nombre: 'Básico', precio: '29 €', periodo: '/mes', descripcion: 'Para empezar', caracteristicas: ['Lo esencial', 'Soporte por correo'], boton: 'Empezar', destacado: false },
      { nombre: 'Pro', precio: '79 €', periodo: '/mes', descripcion: 'El más completo', caracteristicas: ['Todo lo del Básico', 'Soporte prioritario', 'Informes'], boton: 'Elegir Pro', destacado: true },
      { nombre: 'Empresa', precio: '199 €', periodo: '/mes', descripcion: 'Para equipos', caracteristicas: ['Todo lo del Pro', 'Gestor dedicado'], boton: 'Hablar con ventas', destacado: false }] };
    case 'preguntas': return { id, tipo, titulo: 'Preguntas frecuentes', items: [{ pregunta: '¿Cuánto tarda?', respuesta: 'Normalmente lo tienes listo en menos de una semana.' }, { pregunta: '¿Hay permanencia?', respuesta: 'No. Puedes cancelar cuando quieras.' }] };
    case 'logos': return { id, tipo, titulo: 'Confían en nosotros', items: ['Nórdika', 'Lumen', 'Atlas', 'Verdia', 'Kairos'] };
    case 'llamada': return { id, tipo, titulo: '¿Empezamos hoy?', texto: 'Te respondemos en menos de 24 horas.', estilo: 'tarjeta', boton_texto: 'Quiero empezar', boton_accion: 'siguiente', boton_url: '' };
    case 'pasos': return { id, tipo, titulo: 'Así de fácil', items: [{ titulo: 'Cuéntanos', texto: 'Rellena el formulario en un minuto.' }, { titulo: 'Te llamamos', texto: 'Analizamos tu caso sin compromiso.' }, { titulo: 'Resultados', texto: 'Ponemos el plan en marcha.' }] };
    case 'galeria': return { id, tipo, imagenes: [], columnas: 3 };
  }
}

export const seccionNueva = (): Seccion => ({ id: nuevoId(), fondo: '#ffffff', relleno: 'normal', ancho: 'normal', bloques: [] });

// Copia profunda con ids nuevos (para duplicar).
export function conIdsNuevos<T extends Bloque | Seccion>(x: T): T {
  const c = structuredClone(x);
  c.id = nuevoId();
  if ('bloques' in c) c.bloques = c.bloques.map((b) => ({ ...b, id: nuevoId() }));
  return c;
}

// --- Controles básicos ----------------------------------------------------------
const Etq = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-xs font-medium text-texto-2">{t}</span>{children}</label>
);
function Txt({ t, v, on, max = 300, area, ph }: { t: string; v: string; on: (s: string) => void; max?: number; area?: number; ph?: string }) {
  return <Etq t={t}>{area ? <textarea value={v} onChange={(e) => on(e.target.value)} maxLength={max} rows={area} placeholder={ph} className={estiloArea} />
    : <input value={v} onChange={(e) => on(e.target.value)} maxLength={max} placeholder={ph} className={estiloInput} />}</Etq>;
}
function Sel<T extends string>({ t, v, on, op }: { t: string; v: T; on: (s: T) => void; op: [T, string][] }) {
  return <Etq t={t}><select value={v} onChange={(e) => on(e.target.value as T)} className={estiloInput}>{op.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Etq>;
}
function Grupo<T extends string>({ t, v, on, op }: { t: string; v: T; on: (s: T) => void; op: [T, string][] }) {
  return (
    <div><span className="mb-1 block text-xs font-medium text-texto-2">{t}</span>
      <div className="flex rounded border border-borde-fuerte p-0.5" role="radiogroup" aria-label={t}>
        {op.map(([k, n]) => <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => on(k)} className={`flex-1 rounded px-2 py-1 text-xs ${v === k ? 'bg-primario text-white' : 'text-texto-2 hover:bg-superficie-2'}`}>{n}</button>)}
      </div>
    </div>
  );
}
const Casilla = ({ t, v, on }: { t: string; v: boolean; on: (b: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="size-4" />{t}</label>
);
export function ColorCampo({ t, v, on }: { t: string; v: string; on: (s: string) => void }) {
  const [txt, setTxt] = useState(v);
  useEffect(() => setTxt(v), [v]);
  return (
    <Etq t={t}>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={(e) => { on(e.target.value); setTxt(e.target.value); }} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-borde-fuerte bg-superficie p-0.5" aria-label={t} />
        <input value={txt} onChange={(e) => { setTxt(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) on(e.target.value.toLowerCase()); }} maxLength={7} className={estiloInput} />
      </div>
    </Etq>
  );
}
const ALI: ['izquierda' | 'centro' | 'derecha', string][] = [['izquierda', 'Izq.'], ['centro', 'Centro'], ['derecha', 'Der.']];

// Lista editable de textos (elementos de lista, características…).
function ListaTextos({ t, v, on, max = 30 }: { t: string; v: string[]; on: (x: string[]) => void; max?: number }) {
  return (
    <div><span className="mb-1 block text-xs font-medium text-texto-2">{t}</span>
      <div className="space-y-1.5">
        {v.map((e, i) => (
          <div key={i} className="flex gap-1">
            <input value={e} maxLength={300} onChange={(ev) => on(v.map((x, j) => (j === i ? ev.target.value : x)))} className={estiloInput} aria-label={`${t} ${i + 1}`} />
            <button type="button" onClick={() => on(v.filter((_, j) => j !== i))} aria-label="Quitar" className="rounded p-1 text-tenue hover:text-peligro"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {v.length < max && <button type="button" onClick={() => on([...v, ''])} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Añadir</button>}
      </div>
    </div>
  );
}

// Selector de imagen: biblioteca de medios o enlace.
function ImagenCampo({ t, v, on, imagenes, subId }: { t: string; v: string; on: (s: string) => void; imagenes: Imagen[]; subId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="space-y-1.5">
      <Txt t={t} v={v} on={on} max={1000} ph="https://…" />
      <button type="button" onClick={() => setAbierto(true)} className={`${estilosBoton.secundario} w-full`}><ImageIcon className="size-4" /> Elegir de Medios</button>
      <Modal abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Elegir imagen" ancho="max-w-3xl">
        {imagenes.length === 0 ? <p className="py-8 text-center text-sm text-tenue">No hay imágenes en Medios. <a href={`/subcuenta/${subId}/medios`} target="_blank" className="text-primario-texto underline">Súbelas aquí</a> y vuelve a abrir el editor.</p> : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
            {imagenes.map((m) => (
              <button key={m.id} type="button" onClick={() => { on(m.url); setAbierto(false); }} className={`overflow-hidden rounded-lg border-2 text-left ${v === m.url ? 'border-primario' : 'border-borde hover:border-borde-fuerte'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="aspect-square w-full bg-superficie-2 object-cover" loading="lazy" />
                <p className="truncate px-2 py-1 text-xs text-texto-2">{m.nombre}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AccionCampos({ accion, url, on, anclas }: { accion: 'siguiente' | 'url' | 'ancla'; url: string; on: (c: { accion?: 'siguiente' | 'url' | 'ancla'; url?: string }) => void; anclas: string[] }) {
  return (
    <>
      <Sel t="Al hacer clic" v={accion} on={(a) => on({ accion: a, url: a === 'ancla' ? (anclas[0] ? `#${anclas[0]}` : '') : a === 'url' ? '' : url })}
        op={[['siguiente', 'Ir a la página siguiente'], ['url', 'Abrir un enlace'], ['ancla', 'Bajar a una sección']]} />
      {accion === 'url' && <Txt t="Enlace" v={url} on={(u) => on({ url: u })} max={1000} ph="https://… · mailto: · tel:" />}
      {accion === 'ancla' && (anclas.length
        ? <Sel t="Sección" v={url.replace(/^#/, '')} on={(a) => on({ url: `#${a}` })} op={anclas.map((a) => [a, a] as [string, string])} />
        : <p className="text-xs text-aviso">Ponle un «ancla» a una sección (en sus ajustes) para poder enlazarla.</p>)}
    </>
  );
}

// Campos de formulario.
const CLAVES: [string, string, CampoFormulario['tipo']][] = [['nombre', 'Nombre', 'texto'], ['email', 'Correo electrónico', 'email'], ['telefono', 'Teléfono', 'tel'], ['empresa', 'Empresa', 'texto'], ['mensaje', 'Mensaje', 'textarea']];
function CamposFormulario({ v, on }: { v: CampoFormulario[]; on: (c: CampoFormulario[]) => void }) {
  const libre = CLAVES.find(([k]) => !v.some((c) => c.clave === k));
  const mover = (i: number, d: number) => { const n = [...v]; [n[i], n[i + d]] = [n[i + d], n[i]]; on(n); };
  const nuevaClave = () => { let i = 1; while (v.some((c) => c.clave === `campo_${i}`)) i++; return `campo_${i}`; };
  return (
    <div><span className="mb-1 block text-xs font-medium text-texto-2">Campos</span>
      <div className="space-y-2">
        {v.map((c, i) => (
          <div key={c.clave} className="rounded border border-borde p-2">
            <div className="flex items-center gap-1">
              <input value={c.etiqueta} maxLength={80} onChange={(e) => on(v.map((x, j) => (j === i ? { ...x, etiqueta: e.target.value } : x)))} className={estiloInput} aria-label="Etiqueta del campo" />
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir" className="rounded p-1 text-tenue hover:text-texto disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" disabled={i === v.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar" className="rounded p-1 text-tenue hover:text-texto disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
              <button type="button" disabled={v.length <= 1} onClick={() => on(v.filter((_, j) => j !== i))} aria-label="Quitar campo" className="rounded p-1 text-tenue hover:text-peligro disabled:opacity-30"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-tenue">
              <span className="truncate">{CLAVES.find(([k]) => k === c.clave) ? `Va a: ${CLAVES.find(([k]) => k === c.clave)![1].toLowerCase()}` : 'Se guarda en notas'}</span>
              {!['nombre', 'email', 'telefono'].includes(c.clave) && (
                <select value={c.tipo} onChange={(e) => on(v.map((x, j) => (j === i ? { ...x, tipo: e.target.value as CampoFormulario['tipo'] } : x)))} className="ml-auto rounded border border-borde-fuerte bg-superficie px-1 py-0.5 text-xs" aria-label="Tipo">
                  <option value="texto">Texto</option><option value="textarea">Texto largo</option>
                </select>)}
              <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={c.obligatorio} onChange={(e) => on(v.map((x, j) => (j === i ? { ...x, obligatorio: e.target.checked } : x)))} className="size-3.5" /> Obligatorio</label>
            </div>
          </div>
        ))}
        {v.length < 12 && (
          <div className="flex flex-wrap gap-2">
            {libre && <button type="button" onClick={() => on([...v, { clave: libre[0], etiqueta: libre[1], tipo: libre[2], obligatorio: false }])} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> {libre[1]}</button>}
            <button type="button" onClick={() => on([...v, { clave: nuevaClave(), etiqueta: 'Pregunta', tipo: 'texto', obligatorio: false }])} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Pregunta personalizada</button>
          </div>
        )}
        {!v.some((c) => c.clave === 'email' || c.clave === 'telefono') && <p className="text-xs text-peligro">Añade el campo de correo o el de teléfono: sin él no se puede crear el contacto.</p>}
      </div>
    </div>
  );
}

const aLocal = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// --- Propiedades de un bloque ---------------------------------------------------
export function PropiedadesBloque({ b, on, imagenes, calendarios, anclas, subId }: { b: Bloque; on: (b: Bloque) => void; imagenes: Imagen[]; calendarios: Calendario[]; anclas: string[]; subId: string }) {
  const set = (c: Partial<Bloque>) => on({ ...b, ...c } as Bloque);
  switch (b.tipo) {
    case 'titulo': return (<>
      <Txt t="Texto" v={b.texto} on={(texto) => set({ texto })} area={3} />
      <Grupo t="Tamaño" v={String(b.nivel) as '1' | '2' | '3'} on={(n) => set({ nivel: Number(n) as 1 | 2 | 3 })} op={[['1', 'Grande'], ['2', 'Mediano'], ['3', 'Pequeño']]} />
      <Grupo t="Alineación" v={b.alineacion} on={(alineacion) => set({ alineacion })} op={ALI} />
    </>);
    case 'texto': return (<>
      <Txt t="Texto" v={b.texto} on={(texto) => set({ texto })} area={7} max={5000} />
      <Grupo t="Tamaño" v={b.tamano} on={(tamano) => set({ tamano })} op={[['normal', 'Normal'], ['grande', 'Grande']]} />
      <Grupo t="Alineación" v={b.alineacion} on={(alineacion) => set({ alineacion })} op={ALI} />
    </>);
    case 'imagen': return (<>
      <ImagenCampo t="Imagen" v={b.url} on={(url) => set({ url })} imagenes={imagenes} subId={subId} />
      <Txt t="Texto alternativo (accesibilidad)" v={b.alt} on={(alt) => set({ alt })} max={200} />
      <Grupo t="Ancho" v={b.ancho} on={(ancho) => set({ ancho })} op={[['completo', 'Completo'], ['medio', 'Mediano']]} />
      <Casilla t="Esquinas redondeadas" v={b.redondeada} on={(redondeada) => set({ redondeada })} />
    </>);
    case 'boton': return (<>
      <Txt t="Texto del botón" v={b.texto} on={(texto) => set({ texto })} max={80} />
      <AccionCampos accion={b.accion} url={b.url} on={(c) => set(c)} anclas={anclas} />
      <Grupo t="Tamaño" v={b.tamano} on={(tamano) => set({ tamano })} op={[['normal', 'Normal'], ['grande', 'Grande']]} />
      <Grupo t="Alineación" v={b.alineacion} on={(alineacion) => set({ alineacion })} op={ALI} />
    </>);
    case 'video': return <Txt t="Enlace de YouTube o Vimeo" v={b.url} on={(url) => set({ url })} max={500} ph="https://www.youtube.com/watch?v=…" />;
    case 'formulario': return (<>
      <CamposFormulario v={b.campos} on={(campos) => set({ campos })} />
      <Txt t="Texto del botón" v={b.boton} on={(boton) => set({ boton })} max={80} />
      <Txt t="Etiquetas para el contacto (separadas por comas)" v={b.etiquetas.join(', ')} max={600}
        on={(s) => set({ etiquetas: s.split(',').map((x) => x.trim().slice(0, 60)).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 10) })} />
      <Sel t="Después de enviar" v={b.despues} on={(despues) => set({ despues })} op={[['siguiente', 'Ir a la página siguiente'], ['url', 'Ir a un enlace'], ['mensaje', 'Mostrar un mensaje']]} />
      {b.despues === 'url' && <Txt t="Enlace" v={b.url} on={(url) => set({ url })} max={1000} ph="https://…" />}
      <Txt t={b.despues === 'mensaje' ? 'Mensaje' : 'Mensaje (si no hay página siguiente)'} v={b.mensaje} on={(mensaje) => set({ mensaje })} max={500} area={2} />
      <Txt t="Aviso legal bajo el formulario" v={b.aviso_legal} on={(aviso_legal) => set({ aviso_legal })} max={400} area={2} />
      <p className="rounded bg-superficie-2 p-2 text-xs text-tenue">Cada envío crea o actualiza el contacto, le pone estas etiquetas y dispara las automatizaciones con el disparador «Formulario enviado».</p>
    </>);
    case 'lista': return (<>
      <ListaTextos t="Elementos" v={b.elementos} on={(elementos) => set({ elementos })} />
      <Grupo t="Viñeta" v={b.icono} on={(icono) => set({ icono })} op={[['check', 'Check'], ['punto', 'Punto'], ['numero', 'Número']]} />
    </>);
    case 'testimonio': return (<>
      <Txt t="Cita" v={b.cita} on={(cita) => set({ cita })} area={4} max={1000} />
      <Txt t="Autor" v={b.autor} on={(autor) => set({ autor })} max={100} />
      <Txt t="Cargo o empresa" v={b.cargo} on={(cargo) => set({ cargo })} max={100} />
      <ImagenCampo t="Foto (opcional)" v={b.foto} on={(foto) => set({ foto })} imagenes={imagenes} subId={subId} />
    </>);
    case 'precio': return (<>
      <Txt t="Nombre" v={b.titulo} on={(titulo) => set({ titulo })} max={100} />
      <div className="grid grid-cols-2 gap-2"><Txt t="Precio" v={b.precio} on={(precio) => set({ precio })} max={40} /><Txt t="Periodo" v={b.periodo} on={(periodo) => set({ periodo })} max={40} /></div>
      <ListaTextos t="Características" v={b.caracteristicas} on={(caracteristicas) => set({ caracteristicas })} max={20} />
      <Txt t="Texto del botón" v={b.boton} on={(boton) => set({ boton })} max={80} />
      <AccionCampos accion={b.accion} url={b.url} on={(c) => set(c)} anclas={anclas} />
      <Casilla t="Destacar como recomendado" v={b.destacado} on={(destacado) => set({ destacado })} />
    </>);
    case 'cuenta_atras': return (<>
      <Etq t="Termina el"><input type="datetime-local" value={aLocal(b.hasta)} onChange={(e) => { const d = new Date(e.target.value); if (!Number.isNaN(d.getTime())) set({ hasta: d.toISOString() }); }} className={estiloInput} /></Etq>
      <Txt t="Texto al terminar" v={b.texto_fin} on={(texto_fin) => set({ texto_fin })} max={200} />
    </>);
    case 'calendario': return (<>
      {calendarios.length === 0 ? <p className="text-sm text-tenue">No tienes calendarios. <a href={`/subcuenta/${subId}/calendarios`} target="_blank" className="text-primario-texto underline">Crea uno</a> y vuelve a abrir el editor.</p>
        : <Sel t="Calendario" v={b.slug} on={(slug) => set({ slug })} op={[['', 'Elige un calendario…'], ...calendarios.map((c) => [c.slug, `${c.nombre}${c.activo ? '' : ' (inactivo)'}`] as [string, string])]} />}
      <Etq t={`Alto: ${b.alto} px`}><input type="range" min={300} max={1400} step={20} value={b.alto} onChange={(e) => set({ alto: Number(e.target.value) })} className="w-full" /></Etq>
      <p className="text-xs text-tenue">Las citas reservadas aquí aparecen en Calendarios y crean el contacto.</p>
    </>);
    case 'separador': return (<>
      <Grupo t="Estilo" v={b.estilo} on={(estilo) => set({ estilo })} op={[['espacio', 'Espacio'], ['linea', 'Línea']]} />
      <Etq t={`Alto: ${b.alto} px`}><input type="range" min={4} max={200} value={b.alto} onChange={(e) => set({ alto: Number(e.target.value) })} className="w-full" /></Etq>
    </>);
    case 'hero': return (<>
      <Txt t="Etiqueta superior" v={b.etiqueta} on={(etiqueta) => set({ etiqueta })} max={80} />
      <Txt t="Titular (rodea palabras con *asteriscos* para destacarlas)" v={b.titulo} on={(titulo) => set({ titulo })} area={3} max={200} />
      <Txt t="Subtítulo" v={b.subtitulo} on={(subtitulo) => set({ subtitulo })} area={3} max={600} />
      <Txt t="Botón principal" v={b.boton_texto} on={(boton_texto) => set({ boton_texto })} max={80} />
      <AccionCampos accion={b.boton_accion} url={b.boton_url} on={(c) => set({ ...(c.accion ? { boton_accion: c.accion } : {}), ...(c.url !== undefined ? { boton_url: c.url } : {}) })} anclas={anclas} />
      <Txt t="Botón secundario (opcional)" v={b.boton2_texto} on={(boton2_texto) => set({ boton2_texto })} max={80} />
      {b.boton2_texto && <AccionCampos accion={b.boton2_accion} url={b.boton2_url} on={(c) => set({ ...(c.accion ? { boton2_accion: c.accion } : {}), ...(c.url !== undefined ? { boton2_url: c.url } : {}) })} anclas={anclas} />}
      <Txt t="Prueba social (opcional)" v={b.prueba} on={(prueba) => set({ prueba })} max={120} ph="Valorado 4,9 por +500 clientes" />
      <Grupo t="Disposición" v={b.disposicion} on={(disposicion) => set({ disposicion })} op={[['dividido', 'Texto + visual'], ['centro', 'Centrado']]} />
      <VisualCampo v={b.visual} img={b.imagen} on={(visual, imagen) => set({ visual, imagen })} imagenes={imagenes} subId={subId} />
    </>);
    case 'caracteristicas': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={200} />
      <Txt t="Subtítulo" v={b.subtitulo} on={(subtitulo) => set({ subtitulo })} area={2} max={400} />
      <Grupo t="Columnas" v={String(b.columnas) as '2' | '3' | '4'} on={(c) => set({ columnas: Number(c) as 2 | 3 | 4 })} op={[['2', '2'], ['3', '3'], ['4', '4']]} />
      <Grupo t="Estilo" v={b.estilo} on={(estilo) => set({ estilo })} op={[['tarjetas', 'Tarjetas'], ['simple', 'Simple']]} />
      <Elementos t="Ventajas" v={b.items} on={(items) => set({ items })} max={12} nuevo={{ icono: 'rayo', titulo: 'Ventaja', texto: 'Explica el beneficio.' }}
        campos={[['icono', 'Icono', 'icono'], ['titulo', 'Título', 'texto', 100], ['texto', 'Texto', 'area', 400]]} />
    </>);
    case 'imagen_texto': return (<>
      <Txt t="Etiqueta superior" v={b.etiqueta} on={(etiqueta) => set({ etiqueta })} max={80} />
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} area={2} max={200} />
      <Txt t="Texto" v={b.texto} on={(texto) => set({ texto })} area={4} max={1500} />
      <ListaTextos t="Puntos" v={b.puntos} on={(puntos) => set({ puntos })} max={8} />
      <Txt t="Botón (opcional)" v={b.boton_texto} on={(boton_texto) => set({ boton_texto })} max={80} />
      {b.boton_texto && <AccionCampos accion={b.boton_accion} url={b.boton_url} on={(c) => set({ ...(c.accion ? { boton_accion: c.accion } : {}), ...(c.url !== undefined ? { boton_url: c.url } : {}) })} anclas={anclas} />}
      <VisualCampo v={b.visual} img={b.imagen} on={(visual, imagen) => set({ visual, imagen })} imagenes={imagenes} subId={subId} />
      <Casilla t="Visual a la izquierda" v={b.invertir} on={(invertir) => set({ invertir })} />
    </>);
    case 'cifras': return <Elementos t="Cifras" v={b.items} on={(items) => set({ items })} max={6} nuevo={{ valor: '100 %', etiqueta: 'Etiqueta' }} campos={[['valor', 'Cifra', 'texto', 20], ['etiqueta', 'Etiqueta', 'texto', 80]]} />;
    case 'testimonios': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={200} />
      <Elementos t="Testimonios" v={b.items} on={(items) => set({ items })} max={9} nuevo={{ cita: 'Una opinión real de un cliente.', autor: 'Nombre', cargo: 'Cargo', foto: '', estrellas: 5 }}
        campos={[['cita', 'Opinión', 'area', 600], ['autor', 'Autor', 'texto', 80], ['cargo', 'Cargo o empresa', 'texto', 100], ['estrellas', 'Estrellas (0-5)', 'numero', 5]]} />
    </>);
    case 'planes': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={200} />
      <Txt t="Subtítulo" v={b.subtitulo} on={(subtitulo) => set({ subtitulo })} max={400} />
      <AccionCampos accion={b.accion} url={b.url} on={(c) => set(c)} anclas={anclas} />
      <Elementos t="Planes" v={b.items} on={(items) => set({ items })} max={4} nuevo={{ nombre: 'Plan', precio: '49 €', periodo: '/mes', descripcion: '', caracteristicas: ['Ventaja'], boton: 'Empezar', destacado: false }}
        campos={[['nombre', 'Nombre', 'texto', 60], ['precio', 'Precio', 'texto', 30], ['periodo', 'Periodo', 'texto', 30], ['descripcion', 'Descripción', 'texto', 200], ['caracteristicas', 'Incluye', 'lista'], ['boton', 'Botón', 'texto', 60], ['destacado', 'Destacado', 'casilla']]} />
    </>);
    case 'preguntas': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={200} />
      <Elementos t="Preguntas" v={b.items} on={(items) => set({ items })} max={20} nuevo={{ pregunta: '¿Pregunta?', respuesta: 'Respuesta.' }} campos={[['pregunta', 'Pregunta', 'texto', 200], ['respuesta', 'Respuesta', 'area', 1500]]} />
    </>);
    case 'logos': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={120} />
      <ListaTextos t="Nombres de clientes o medios" v={b.items} on={(items) => set({ items })} max={10} />
    </>);
    case 'llamada': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} area={2} max={200} />
      <Txt t="Texto" v={b.texto} on={(texto) => set({ texto })} area={2} max={500} />
      <Txt t="Botón" v={b.boton_texto} on={(boton_texto) => set({ boton_texto })} max={80} />
      <AccionCampos accion={b.boton_accion} url={b.boton_url} on={(c) => set({ ...(c.accion ? { boton_accion: c.accion } : {}), ...(c.url !== undefined ? { boton_url: c.url } : {}) })} anclas={anclas} />
      <Grupo t="Estilo" v={b.estilo} on={(estilo) => set({ estilo })} op={[['tarjeta', 'Tarjeta de color'], ['plano', 'Sencillo']]} />
    </>);
    case 'pasos': return (<>
      <Txt t="Título" v={b.titulo} on={(titulo) => set({ titulo })} max={200} />
      <Elementos t="Pasos" v={b.items} on={(items) => set({ items })} max={6} nuevo={{ titulo: 'Paso', texto: 'Qué ocurre.' }} campos={[['titulo', 'Título', 'texto', 100], ['texto', 'Texto', 'area', 400]]} />
    </>);
    case 'galeria': return (<>
      <Grupo t="Columnas" v={String(b.columnas) as '2' | '3' | '4'} on={(c) => set({ columnas: Number(c) as 2 | 3 | 4 })} op={[['2', '2'], ['3', '3'], ['4', '4']]} />
      {b.imagenes.map((u, i) => (
        <div key={i} className="flex items-end gap-1">
          <div className="min-w-0 flex-1"><ImagenCampo t={`Imagen ${i + 1}`} v={u} on={(x) => set({ imagenes: b.imagenes.map((y, j) => (j === i ? x : y)) })} imagenes={imagenes} subId={subId} /></div>
          <button type="button" onClick={() => set({ imagenes: b.imagenes.filter((_, j) => j !== i) })} aria-label="Quitar imagen" className="mb-1 rounded p-1 text-tenue hover:text-peligro"><Trash2 className="size-4" /></button>
        </div>
      ))}
      {b.imagenes.length < 12 && <button type="button" onClick={() => set({ imagenes: [...b.imagenes, ''] })} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Añadir imagen</button>}
    </>);
  }
}

// Visual de un bloque: ninguno, imagen propia o una de las ilustraciones.
function VisualCampo({ v, img, on, imagenes, subId }: { v: Visual; img: string; on: (v: Visual, img: string) => void; imagenes: Imagen[]; subId: string }) {
  return (<>
    <Sel t="Visual" v={v} on={(x) => on(x, img)} op={[['tarjetas', 'Tarjetas flotantes'], ['panel', 'Panel de control'], ['movil', 'Móvil con chat'], ['chat', 'Ventana de chat'], ['imagen', 'Mi imagen'], ['ninguno', 'Ninguno']]} />
    {v === 'imagen' && <ImagenCampo t="Imagen" v={img} on={(x) => on(v, x)} imagenes={imagenes} subId={subId} />}
  </>);
}

// Editor genérico de elementos repetibles (ventajas, testimonios, planes…).
type TipoCampo = 'texto' | 'area' | 'icono' | 'numero' | 'casilla' | 'lista';
function Elementos<T extends Record<string, unknown>>({ t, v, on, campos, nuevo, max }: { t: string; v: T[]; on: (x: T[]) => void; campos: [keyof T & string, string, TipoCampo, number?][]; nuevo: T; max: number }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const cambiar = (i: number, k: string, x: unknown) => on(v.map((e, j) => (j === i ? { ...e, [k]: x } : e)));
  const mover = (i: number, d: number) => { const n = [...v]; [n[i], n[i + d]] = [n[i + d], n[i]]; on(n); };
  return (
    <div><span className="mb-1 block text-xs font-medium text-texto-2">{t}</span>
      <div className="space-y-1.5">
        {v.map((e, i) => (
          <div key={i} className="rounded border border-borde">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button type="button" onClick={() => setAbierto(abierto === i ? null : i)} className="min-w-0 flex-1 truncate text-left text-sm text-texto">{String(e[campos.find((c) => c[2] === 'texto')?.[0] ?? campos[0][0]] ?? `Elemento ${i + 1}`) || `Elemento ${i + 1}`}</button>
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir" className="rounded p-0.5 text-tenue hover:text-texto disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" disabled={i === v.length - 1} onClick={() => mover(i, 1)} aria-label="Bajar" className="rounded p-0.5 text-tenue hover:text-texto disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
              <button type="button" onClick={() => on(v.filter((_, j) => j !== i))} aria-label="Quitar" className="rounded p-0.5 text-tenue hover:text-peligro"><Trash2 className="size-3.5" /></button>
            </div>
            {abierto === i && (
              <div className="space-y-2 border-t border-borde p-2">
                {campos.map(([k, et, tipo, mx]) => {
                  const val = e[k];
                  if (tipo === 'casilla') return <Casilla key={k} t={et} v={Boolean(val)} on={(x) => cambiar(i, k, x)} />;
                  if (tipo === 'numero') return <Etq key={k} t={et}><input type="number" min={0} max={mx} value={Number(val ?? 0)} onChange={(ev) => cambiar(i, k, Math.max(0, Math.min(mx ?? 100, Number(ev.target.value) || 0)))} className={estiloInput} /></Etq>;
                  if (tipo === 'lista') return <ListaTextos key={k} t={et} v={(val as string[]) ?? []} on={(x) => cambiar(i, k, x)} max={12} />;
                  if (tipo === 'icono') return (
                    <div key={k}><span className="mb-1 block text-xs font-medium text-texto-2">{et}</span>
                      <div className="flex flex-wrap gap-1">{Object.entries(ICONOS).map(([n, I]) => (
                        <button key={n} type="button" title={n} aria-label={n} aria-pressed={val === n} onClick={() => cambiar(i, k, n)} className={`rounded p-1.5 ${val === n ? 'bg-primario text-white' : 'text-texto-2 hover:bg-superficie-2'}`}><I className="size-4" /></button>
                      ))}</div>
                    </div>
                  );
                  return <Txt key={k} t={et} v={String(val ?? '')} on={(x) => cambiar(i, k, x)} max={mx ?? 300} area={tipo === 'area' ? 3 : undefined} />;
                })}
              </div>
            )}
          </div>
        ))}
        {v.length < max && <button type="button" onClick={() => { on([...v, structuredClone(nuevo)]); setAbierto(v.length); }} className="inline-flex items-center gap-1 text-xs font-medium text-primario-texto"><Plus className="size-3.5" /> Añadir</button>}
      </div>
    </div>
  );
}

export function PropiedadesSeccion({ s, on }: { s: Seccion; on: (s: Seccion) => void }) {
  return (<>
    <Sel t="Tipo de fondo" v={s.fondo_tipo ?? 'solido'} on={(fondo_tipo) => on({ ...s, fondo_tipo })} op={[['solido', 'Color liso'], ['degradado', 'Degradado'], ['malla', 'Malla de color'], ['imagen', 'Imagen']]} />
    <ColorCampo t={s.fondo_tipo === 'degradado' ? 'Color inicial' : 'Fondo'} v={s.fondo} on={(fondo) => on({ ...s, fondo })} />
    {s.fondo_tipo === 'degradado' && <ColorCampo t="Color final" v={s.fondo2 ?? '#ffffff'} on={(fondo2) => on({ ...s, fondo2 })} />}
    {s.fondo_tipo === 'imagen' && (<>
      <Txt t="Imagen de fondo (enlace https)" v={s.imagen_fondo ?? ''} on={(imagen_fondo) => on({ ...s, imagen_fondo })} max={1000} ph="https://…" />
      <Etq t={`Oscurecer: ${s.oscurecer ?? 55} %`}><input type="range" min={0} max={90} value={s.oscurecer ?? 55} onChange={(e) => on({ ...s, oscurecer: Number(e.target.value) })} className="w-full" /></Etq>
    </>)}
    <Grupo t="Espaciado" v={s.relleno} on={(relleno) => on({ ...s, relleno })} op={[['pequeno', 'Poco'], ['normal', 'Normal'], ['grande', 'Mucho']]} />
    <Grupo t="Ancho del contenido" v={s.ancho} on={(ancho) => on({ ...s, ancho })} op={[['estrecho', 'Estrecho'], ['normal', 'Normal'], ['ancho', 'Ancho']]} />
    <Txt t="Ancla (para enlazar con #)" v={s.ancla ?? ''} max={40} ph="ej. precios"
      on={(a) => on({ ...s, ancla: a.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || undefined })} />
  </>);
}

export function PropiedadesEstilo({ e, on }: { e: Contenido['estilo']; on: (e: Contenido['estilo']) => void }) {
  return (<>
    <ColorCampo t="Color principal (botones, iconos)" v={e.color_primario} on={(color_primario) => on({ ...e, color_primario })} />
    <ColorCampo t="Fondo de la página" v={e.fondo} on={(fondo) => on({ ...e, fondo })} />
    <ColorCampo t="Color de acento (degradados)" v={e.color_acento ?? '#7a5af8'} on={(color_acento) => on({ ...e, color_acento })} />
    <Sel t="Tipografía" v={e.fuente} on={(fuente) => on({ ...e, fuente })} op={[['sans', 'Moderna (Inter)'], ['geometrica', 'Geométrica (Plus Jakarta)'], ['elegante', 'Elegante (Playfair)'], ['editorial', 'Editorial (Fraunces)'], ['redondeada', 'Redondeada (Nunito)'], ['serif', 'Clásica (Georgia)']]} />
    <Grupo t="Esquinas" v={e.radio ?? 'suave'} on={(radio) => on({ ...e, radio })} op={[['recto', 'Rectas'], ['suave', 'Suaves'], ['redondo', 'Redondas']]} />
  </>);
}
