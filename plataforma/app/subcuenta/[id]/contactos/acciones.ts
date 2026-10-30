'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { leerFormulario, primerError } from '@/lib/validacion';
import { CAMPOS_FORM_CONTACTO, esquemaContacto, leerCamposPersonalizados, telefonoParaGuardar, valorCampo } from '@/lib/crm/validacion';
import { escaparLike } from '@/lib/crm/filtros';
import { normalizarTelefono, slug } from '@/lib/crm/csv';
import type { Campo, Filtro, ValorCampo } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ResultadoId = Resultado & { id?: string };

function validarIds(...ids: string[]) {
  if (ids.some((i) => !UUID.test(i))) throw new Error('Identificador no válido.');
}

async function contexto(subId: string) {
  validarIds(subId);
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  return { usuario, supabase };
}

const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}`, 'layout');

async function prefijoDe(supabase: SupabaseClient, subId: string) {
  const { data } = await supabase.from('subcuentas').select('prefijo').eq('id', subId).maybeSingle();
  return (data?.prefijo as string) ?? '+34';
}

async function camposDe(supabase: SupabaseClient, subId: string): Promise<Campo[]> {
  const { data } = await supabase.from('crm_campos').select('id, clave, nombre, tipo, opciones, carpeta, orden').eq('subcuenta_id', subId);
  return (data ?? []) as Campo[];
}

// Busca la empresa por nombre (sin distinguir mayúsculas) o la crea.
async function empresaId(supabase: SupabaseClient, subId: string, nombre: string, cache?: Map<string, string>): Promise<string | null> {
  const n = nombre.trim();
  if (!n) return null;
  const k = n.toLowerCase();
  if (cache?.has(k)) return cache.get(k)!;
  const { data } = await supabase.from('crm_empresas').select('id').eq('subcuenta_id', subId).ilike('nombre', escaparLike(n)).maybeSingle();
  let id = data?.id as string | undefined;
  if (!id) {
    const ins = await supabase.from('crm_empresas').insert({ subcuenta_id: subId, nombre: n.slice(0, 160) }).select('id').single();
    if (ins.error) {
      // Otro proceso la creó a la vez: se vuelve a leer.
      const otra = await supabase.from('crm_empresas').select('id').eq('subcuenta_id', subId).ilike('nombre', escaparLike(n)).maybeSingle();
      id = otra.data?.id as string | undefined;
      if (!id) throw new Error(mensajeDeError(ins.error));
    } else id = ins.data.id as string;
  }
  cache?.set(k, id);
  return id;
}

// --- Contactos -----------------------------------------------------------------

async function datosContacto(supabase: SupabaseClient, subId: string, fd: FormData) {
  const datos = esquemaContacto.safeParse(leerFormulario(fd, CAMPOS_FORM_CONTACTO));
  if (!datos.success) throw new Error(primerError(datos.error));
  const { empresa, telefono, ...resto } = datos.data;
  const campos = leerCamposPersonalizados(fd, await camposDe(supabase, subId));
  return {
    ...resto,
    telefono: telefonoParaGuardar(telefono, await prefijoDe(supabase, subId)),
    empresa_id: await empresaId(supabase, subId, empresa),
    campos,
  };
}

export async function crearContacto(subId: string, _: ResultadoId | null, fd: FormData): Promise<ResultadoId> {
  try {
    const { supabase, usuario } = await contexto(subId);
    const fila = await datosContacto(supabase, subId, fd);
    const etiquetas = String(fd.get('etiquetas') ?? '').split(',').map((e) => e.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from('crm_contactos')
      .insert({ ...fila, etiquetas, subcuenta_id: subId, creado_por: usuario.id })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe un contacto con ese correo.' : mensajeDeError(error) };
    refrescar(subId);
    return { ok: true, mensaje: 'Contacto creado.', id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function actualizarContacto(subId: string, contactoId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    validarIds(contactoId);
    const { supabase } = await contexto(subId);
    const fila = await datosContacto(supabase, subId, fd);
    // Conserva valores de campos personalizados que este formulario no muestra.
    const { data: actual } = await supabase.from('crm_contactos').select('campos').eq('id', contactoId).maybeSingle();
    const conocidos = new Set((await camposDe(supabase, subId)).map((c) => c.clave));
    const previos = Object.fromEntries(Object.entries((actual?.campos ?? {}) as Record<string, ValorCampo>).filter(([k]) => !conocidos.has(k)));
    const { data, error } = await supabase
      .from('crm_contactos')
      .update({ ...fila, campos: { ...previos, ...fila.campos } })
      .eq('id', contactoId)
      .eq('subcuenta_id', subId)
      .select('id');
    if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe otro contacto con ese correo.' : mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró el contacto.' };
    refrescar(subId);
    return { ok: true, mensaje: 'Cambios guardados.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cambiarEtiquetas(subId: string, contactoId: string, etiquetas: string[]): Promise<Resultado> {
  validarIds(contactoId);
  const { supabase } = await contexto(subId);
  const limpias = etiquetas.map((e) => String(e).trim().slice(0, 60)).filter(Boolean).slice(0, 100);
  const { error } = await supabase.from('crm_contactos').update({ etiquetas: limpias }).eq('id', contactoId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function cambiarDnd(subId: string, contactoId: string, dnd: boolean, canales: string[]): Promise<Resultado> {
  validarIds(contactoId);
  const { supabase } = await contexto(subId);
  const validos = canales.filter((c) => ['email', 'sms', 'llamada', 'whatsapp'].includes(c));
  const { error } = await supabase
    .from('crm_contactos')
    .update({ dnd, dnd_canales: dnd ? [] : validos })
    .eq('id', contactoId)
    .eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function cambiarPropietario(subId: string, contactoId: string, propietario: string | null): Promise<Resultado> {
  validarIds(contactoId, ...(propietario ? [propietario] : []));
  const { supabase } = await contexto(subId);
  const { error } = await supabase.from('crm_contactos').update({ propietario_id: propietario }).eq('id', contactoId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarContacto(subId: string, contactoId: string): Promise<Resultado> {
  validarIds(contactoId);
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.from('crm_contactos').delete().eq('id', contactoId).eq('subcuenta_id', subId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo un administrador puede borrar contactos.' };
  refrescar(subId);
  return { ok: true };
}

const OPERACIONES = ['añadir_etiqueta', 'quitar_etiqueta', 'asignar_propietario', 'borrar'] as const;

export async function accionLote(subId: string, ids: string[], operacion: (typeof OPERACIONES)[number], valor?: string): Promise<Resultado> {
  if (!OPERACIONES.includes(operacion)) return { ok: false, error: 'Operación no válida.' };
  if (!ids.length) return { ok: false, error: 'No hay contactos seleccionados.' };
  if (ids.length > 5000) return { ok: false, error: 'Máximo 5.000 contactos por operación.' };
  validarIds(...ids);
  if (operacion === 'asignar_propietario' && valor) validarIds(valor);
  if ((operacion === 'añadir_etiqueta' || operacion === 'quitar_etiqueta') && !valor?.trim()) return { ok: false, error: 'Indica la etiqueta.' };
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.rpc('crm_contactos_lote', { p_subcuenta: subId, p_ids: ids, p_operacion: operacion, p_valor: valor ?? null });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  const n = Number(data);
  if (operacion === 'borrar' && n === 0) return { ok: false, error: 'Solo un administrador puede borrar contactos.' };
  return { ok: true, mensaje: `${n} ${n === 1 ? 'contacto actualizado' : 'contactos actualizados'}.` };
}

// --- Listas inteligentes ----------------------------------------------------------

export async function guardarLista(subId: string, datos: { id?: string; nombre: string; compartida: boolean; filtros: Filtro[]; busqueda: string; orden: string; columnas: string[] }): Promise<ResultadoId> {
  const { supabase } = await contexto(subId);
  const nombre = datos.nombre.trim().slice(0, 60);
  if (!nombre) return { ok: false, error: 'Pon un nombre a la lista.' };
  const fila = {
    nombre,
    compartida: Boolean(datos.compartida),
    filtros: datos.filtros.slice(0, 20),
    busqueda: datos.busqueda.slice(0, 200),
    orden: datos.orden.slice(0, 40),
    columnas: datos.columnas.slice(0, 60).map((c) => String(c).slice(0, 60)),
  };
  const r = datos.id
    ? (validarIds(datos.id), await supabase.from('crm_listas').update(fila).eq('id', datos.id).eq('subcuenta_id', subId).select('id').single())
    : await supabase.from('crm_listas').insert({ ...fila, subcuenta_id: subId }).select('id').single();
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true, id: r.data.id, mensaje: 'Lista guardada.' };
}

export async function borrarLista(subId: string, listaId: string): Promise<Resultado> {
  validarIds(listaId);
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.from('crm_listas').delete().eq('id', listaId).eq('subcuenta_id', subId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo quien creó la lista o un administrador pueden borrarla.' };
  refrescar(subId);
  return { ok: true };
}

// --- Importación -------------------------------------------------------------------

const MAX_FILAS_TROZO = 250;

export interface ResultadoImportacion {
  ok: boolean;
  loteId?: string;
  creados: number;
  actualizados: number;
  errores: { fila: number; motivo: string }[];
  error?: string;
}

/**
 * Importa un trozo de filas ya mapeadas ({campo: valor}). El navegador parte
 * el CSV en trozos y los manda uno tras otro, reutilizando el mismo loteId.
 */
export async function importarTrozo(
  subId: string,
  entrada: {
    loteId?: string;
    archivo: string;
    filas: Record<string, string>[];
    inicio: number; // número de fila del primer elemento (para los mensajes)
    totalFilas: number;
    duplicados: 'actualizar' | 'omitir';
    etiqueta: string;
    ultimo: boolean;
  },
): Promise<ResultadoImportacion> {
  const vacio = { creados: 0, actualizados: 0, errores: [] as { fila: number; motivo: string }[] };
  try {
    const { supabase, usuario } = await contexto(subId);
    if (entrada.filas.length > MAX_FILAS_TROZO) return { ok: false, ...vacio, error: 'Trozo demasiado grande.' };

    let loteId = entrada.loteId;
    if (loteId) validarIds(loteId);
    else {
      const { data, error } = await supabase
        .from('crm_acciones_lote')
        .insert({ subcuenta_id: subId, etiqueta: entrada.archivo.slice(0, 200) || 'Importación', operacion: 'importar', estado: 'en_curso', total: entrada.totalFilas })
        .select('id')
        .single();
      if (error) return { ok: false, ...vacio, error: mensajeDeError(error) };
      loteId = data.id as string;
    }

    const prefijo = await prefijoDe(supabase, subId);
    const campos = await camposDe(supabase, subId);
    const porClave = new Map(campos.map((c) => [c.clave, c]));
    const cacheEmpresas = new Map<string, string>();
    const etiquetaExtra = entrada.etiqueta.trim().slice(0, 60);
    const res = { ...vacio, errores: [] as { fila: number; motivo: string }[] };

    // Contactos ya existentes con esos correos (para actualizar u omitir).
    const correos = entrada.filas.map((f) => (f.email ?? '').trim().toLowerCase()).filter(Boolean);
    const existentes = new Map<string, { id: string; etiquetas: string[]; campos: Record<string, ValorCampo> }>();
    if (correos.length) {
      const { data } = await supabase.from('crm_contactos').select('id, email, etiquetas, campos').eq('subcuenta_id', subId).in('email', correos);
      for (const c of data ?? []) existentes.set(c.email as string, c as never);
    }

    const nuevos: Record<string, unknown>[] = [];
    const numFilaNuevo: number[] = [];
    for (let i = 0; i < entrada.filas.length; i++) {
      const f = entrada.filas[i];
      const n = entrada.inicio + i;
      try {
        let nombre = (f.nombre ?? '').trim();
        let apellidos = (f.apellidos ?? '').trim();
        if (!nombre && !apellidos && f.nombre_completo) {
          const partes = f.nombre_completo.trim().split(/\s+/);
          nombre = partes.shift() ?? '';
          apellidos = partes.join(' ');
        }
        const email = (f.email ?? '').trim().toLowerCase();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`correo no válido (${email})`);
        const telefono = f.telefono ? normalizarTelefono(f.telefono, prefijo) : '';
        if (telefono && !/^\+[0-9]{6,15}$/.test(telefono)) throw new Error(`teléfono no válido (${f.telefono})`);
        if (!nombre && !apellidos && !email && !telefono) throw new Error('fila sin nombre, correo ni teléfono');
        const tipoTxt = (f.tipo ?? '').trim().toLowerCase();
        const tipo = ['cliente', 'customer', 'client'].includes(tipoTxt) ? 'cliente' : 'lead';
        const fecha = (f.fecha_nacimiento ?? '').trim();
        const etiquetas = [...(f.etiquetas ?? '').split(/[,;|]/), etiquetaExtra].map((e) => e.trim()).filter(Boolean);
        const camposFila: Record<string, ValorCampo> = {};
        for (const [k, v] of Object.entries(f)) {
          if (!k.startsWith('campo:')) continue;
          const def = porClave.get(k.slice(6));
          if (!def) continue;
          const crudo = def.tipo === 'casillas' ? v.split(/[,;|]/).map((x) => x.trim()) : def.tipo === 'si_no' ? (/^(s[ií]|yes|true|1)$/i.test(v.trim()) ? 'si' : v.trim() ? 'no' : '') : v;
          const val = valorCampo(def, crudo);
          if (val !== undefined) camposFila[def.clave] = val;
        }
        const fila: Record<string, unknown> = {
          nombre: nombre.slice(0, 100), apellidos: apellidos.slice(0, 100), email: email || null, telefono, tipo,
          fuente: (f.fuente ?? '').trim().slice(0, 100) || 'Importación CSV',
          direccion: (f.direccion ?? '').trim().slice(0, 200), ciudad: (f.ciudad ?? '').trim().slice(0, 100),
          provincia: (f.provincia ?? '').trim().slice(0, 100), codigo_postal: (f.codigo_postal ?? '').trim().slice(0, 12),
          pais: (f.pais ?? '').trim().slice(0, 60), web: (f.web ?? '').trim().slice(0, 200),
          fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
          empresa_id: f.empresa ? await empresaId(supabase, subId, f.empresa, cacheEmpresas) : null,
        };
        const previo = email ? existentes.get(email) : undefined;
        if (previo) {
          if (entrada.duplicados === 'omitir') continue;
          // Solo se sobrescriben los campos que trae el CSV.
          const cambios = Object.fromEntries(Object.entries(fila).filter(([k, v]) => v !== '' && v !== null && (k !== 'fuente' || f.fuente)));
          const { error } = await supabase
            .from('crm_contactos')
            .update({ ...cambios, etiquetas: Array.from(new Set([...previo.etiquetas, ...etiquetas])), campos: { ...previo.campos, ...camposFila } })
            .eq('id', previo.id);
          if (error) throw new Error(mensajeDeError(error));
          res.actualizados++;
        } else {
          if (email) existentes.set(email, { id: '', etiquetas, campos: camposFila }); // duplicado dentro del propio CSV
          nuevos.push({ ...fila, etiquetas, campos: camposFila, subcuenta_id: subId, creado_por: usuario.id });
          numFilaNuevo.push(n);
        }
      } catch (e) {
        res.errores.push({ fila: n, motivo: (e as Error).message });
      }
    }

    if (nuevos.length) {
      const { error } = await supabase.from('crm_contactos').insert(nuevos);
      if (!error) res.creados += nuevos.length;
      else {
        // Si falla el bloque, se inserta fila a fila para saber cuál falla.
        for (let i = 0; i < nuevos.length; i++) {
          const r = await supabase.from('crm_contactos').insert(nuevos[i]);
          if (r.error) res.errores.push({ fila: numFilaNuevo[i], motivo: r.error.code === '23505' ? 'correo repetido' : mensajeDeError(r.error) });
          else res.creados++;
        }
      }
    }

    // Acumula los contadores en el registro de la acción en lote.
    const { data: lote } = await supabase.from('crm_acciones_lote').select('correctos, errores, detalle').eq('id', loteId).single();
    const detalle = (lote?.detalle ?? {}) as { muestra_errores?: { fila: number; motivo: string }[] };
    await supabase
      .from('crm_acciones_lote')
      .update({
        correctos: (lote?.correctos ?? 0) + res.creados + res.actualizados,
        errores: (lote?.errores ?? 0) + res.errores.length,
        detalle: { ...detalle, muestra_errores: [...(detalle.muestra_errores ?? []), ...res.errores].slice(0, 100) },
        ...(entrada.ultimo ? { estado: 'completada', completado: new Date().toISOString() } : {}),
      })
      .eq('id', loteId);
    if (entrada.ultimo) refrescar(subId);
    return { ok: true, loteId, ...res };
  } catch (e) {
    return { ok: false, ...vacio, error: (e as Error).message };
  }
}

// --- Notas ------------------------------------------------------------------------

export async function crearNota(subId: string, contactoId: string, cuerpo: string): Promise<Resultado> {
  validarIds(contactoId);
  const texto = cuerpo.trim();
  if (!texto) return { ok: false, error: 'La nota está vacía.' };
  const { supabase, usuario } = await contexto(subId);
  const { error } = await supabase.from('crm_notas').insert({ subcuenta_id: subId, contacto_id: contactoId, cuerpo: texto.slice(0, 10000), autor_id: usuario.id });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function editarNota(subId: string, notaId: string, cuerpo: string): Promise<Resultado> {
  validarIds(notaId);
  const texto = cuerpo.trim();
  if (!texto) return { ok: false, error: 'La nota está vacía.' };
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.from('crm_notas').update({ cuerpo: texto.slice(0, 10000) }).eq('id', notaId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo su autor o un administrador pueden editarla.' };
  refrescar(subId);
  return { ok: true };
}

export async function borrarNota(subId: string, notaId: string): Promise<Resultado> {
  validarIds(notaId);
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.from('crm_notas').delete().eq('id', notaId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo su autor o un administrador pueden borrarla.' };
  refrescar(subId);
  return { ok: true };
}

// --- Tareas -----------------------------------------------------------------------

const esquemaTarea = z.object({
  titulo: z.string().trim().min(1, 'Pon un título').max(200),
  descripcion: z.string().trim().max(5000),
  vence: z.string().trim().refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Fecha no válida'),
  asignado_id: z.string().trim().refine((v) => v === '' || UUID.test(v), 'Persona no válida'),
  contacto_id: z.string().trim().refine((v) => v === '' || UUID.test(v), 'Contacto no válido'),
  zona: z.string().trim(),
});

// `vence` llega como "AAAA-MM-DDTHH:MM" en la hora local del navegador; `zona`
// es su desfase en minutos (getTimezoneOffset) para guardarlo bien en UTC.
export async function guardarTarea(subId: string, tareaId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const datos = esquemaTarea.safeParse(leerFormulario(fd, ['titulo', 'descripcion', 'vence', 'asignado_id', 'contacto_id', 'zona']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const { supabase } = await contexto(subId);
  const d = datos.data;
  let vence: string | null = null;
  if (d.vence) {
    const desfase = Number(d.zona) || 0;
    vence = new Date(Date.parse(d.vence + 'Z') + desfase * 60_000).toISOString();
  }
  const fila = { titulo: d.titulo, descripcion: d.descripcion, vence, asignado_id: d.asignado_id || null, contacto_id: d.contacto_id || null };
  const r = tareaId
    ? (validarIds(tareaId), await supabase.from('crm_tareas').update(fila).eq('id', tareaId).eq('subcuenta_id', subId).select('id'))
    : await supabase.from('crm_tareas').insert({ ...fila, subcuenta_id: subId }).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true, mensaje: tareaId ? 'Tarea guardada.' : 'Tarea creada.' };
}

export async function alternarTarea(subId: string, tareaId: string, completada: boolean): Promise<Resultado> {
  validarIds(tareaId);
  const { supabase } = await contexto(subId);
  const { error } = await supabase
    .from('crm_tareas')
    .update({ completada: completada ? new Date().toISOString() : null })
    .eq('id', tareaId)
    .eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarTarea(subId: string, tareaId: string): Promise<Resultado> {
  validarIds(tareaId);
  const { supabase } = await contexto(subId);
  const { error } = await supabase.from('crm_tareas').delete().eq('id', tareaId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

// --- Empresas ----------------------------------------------------------------------

const esquemaEmpresa = z.object({
  nombre: z.string().trim().min(1, 'Pon un nombre').max(160),
  email: z.string().trim().toLowerCase().refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Correo no válido').transform((v) => v || null),
  telefono: z.string().trim().max(30),
  web: z.string().trim().max(200).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'La web tiene que empezar por http:// o https://'),
  direccion: z.string().trim().max(200),
  ciudad: z.string().trim().max(100),
  pais: z.string().trim().max(60),
});

export async function guardarEmpresa(subId: string, empresaIdEditar: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const datos = esquemaEmpresa.safeParse(leerFormulario(fd, ['nombre', 'email', 'telefono', 'web', 'direccion', 'ciudad', 'pais']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const { supabase } = await contexto(subId);
  const r = empresaIdEditar
    ? (validarIds(empresaIdEditar), await supabase.from('crm_empresas').update(datos.data).eq('id', empresaIdEditar).eq('subcuenta_id', subId).select('id'))
    : await supabase.from('crm_empresas').insert({ ...datos.data, subcuenta_id: subId }).select('id');
  if (r.error) return { ok: false, error: r.error.code === '23505' ? 'Ya existe una empresa con ese nombre.' : mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true, mensaje: 'Empresa guardada.' };
}

export async function borrarEmpresa(subId: string, empresaIdBorrar: string): Promise<Resultado> {
  validarIds(empresaIdBorrar);
  const { supabase } = await contexto(subId);
  const { data, error } = await supabase.from('crm_empresas').delete().eq('id', empresaIdBorrar).eq('subcuenta_id', subId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo un administrador puede borrar empresas.' };
  refrescar(subId);
  return { ok: true };
}

// --- Campos personalizados --------------------------------------------------------

const esquemaCampo = z.object({
  nombre: z.string().trim().min(1, 'Pon un nombre').max(80),
  tipo: z.enum(['texto', 'texto_largo', 'numero', 'moneda', 'fecha', 'lista', 'casillas', 'si_no', 'telefono', 'email', 'url']),
  opciones: z.string().transform((v) => Array.from(new Set(v.split('\n').map((o) => o.trim()).filter(Boolean))).slice(0, 200)),
  carpeta: z.string().trim().max(60).transform((v) => v || 'Información adicional'),
});

export async function guardarCampo(subId: string, campoId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const datos = esquemaCampo.safeParse(leerFormulario(fd, ['nombre', 'tipo', 'opciones', 'carpeta']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const d = datos.data;
  if ((d.tipo === 'lista' || d.tipo === 'casillas') && d.opciones.length === 0) return { ok: false, error: 'Añade al menos una opción (una por línea).' };
  const { supabase } = await contexto(subId);
  const fila = { nombre: d.nombre, tipo: d.tipo, opciones: d.tipo === 'lista' || d.tipo === 'casillas' ? d.opciones : [], carpeta: d.carpeta };
  let r;
  if (campoId) {
    validarIds(campoId);
    r = await supabase.from('crm_campos').update(fila).eq('id', campoId).eq('subcuenta_id', subId).select('id');
  } else {
    // La clave sale del nombre; si ya existe se le añade un número.
    const base = slug(d.nombre);
    const { data: usadas } = await supabase.from('crm_campos').select('clave').eq('subcuenta_id', subId).like('clave', `${base}%`);
    const set = new Set((usadas ?? []).map((u) => u.clave));
    let clave = base;
    for (let i = 2; set.has(clave); i++) clave = `${base.slice(0, 46)}_${i}`;
    r = await supabase.from('crm_campos').insert({ ...fila, clave, subcuenta_id: subId }).select('id');
  }
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede gestionar campos.' };
  refrescar(subId);
  return { ok: true, mensaje: 'Campo guardado.' };
}

export async function borrarCampo(subId: string, campoId: string): Promise<Resultado> {
  validarIds(campoId);
  const { supabase } = await contexto(subId);
  const { error } = await supabase.rpc('crm_borrar_campo', { p_campo: campoId });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

// --- Búsqueda para selectores --------------------------------------------------------

export async function buscarContactos(subId: string, texto: string) {
  const { supabase } = await contexto(subId);
  let q = supabase.from('crm_contactos').select('id, nombre, apellidos, email, telefono').eq('subcuenta_id', subId).order('creado', { ascending: false }).limit(10);
  const t = texto.trim().toLowerCase();
  if (t) q = q.ilike('busqueda', `%${escaparLike(t)}%`);
  const { data } = await q;
  return (data ?? []) as { id: string; nombre: string; apellidos: string; email: string | null; telefono: string }[];
}

// --- Etiquetas (catálogo) ----------------------------------------------------------

export async function guardarEtiqueta(subId: string, original: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const { supabase } = await contexto(subId);
  const nombre = String(fd.get('nombre') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const descripcion = String(fd.get('descripcion') ?? '').trim().slice(0, 300);
  const categoria = String(fd.get('categoria') ?? '').trim().slice(0, 60);
  if (!nombre) return { ok: false, error: 'Pon un nombre a la etiqueta.' };
  if (original && original !== nombre) {
    const r = await supabase.rpc('crm_renombrar_etiqueta', { p_subcuenta: subId, p_antes: original, p_despues: nombre });
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  }
  const { error } = await supabase.from('crm_etiquetas').upsert({ subcuenta_id: subId, nombre, descripcion, categoria }, { onConflict: 'subcuenta_id,nombre' });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true, mensaje: 'Etiqueta guardada.' };
}

export async function borrarEtiquetas(subId: string, nombres: string[]): Promise<Resultado> {
  const { supabase } = await contexto(subId);
  let total = 0;
  for (const n of nombres.slice(0, 500)) {
    const { data, error } = await supabase.rpc('crm_borrar_etiqueta', { p_subcuenta: subId, p_nombre: n });
    if (error) return { ok: false, error: mensajeDeError(error) };
    total += Number(data);
  }
  refrescar(subId);
  return { ok: true, mensaje: `Borradas ${nombres.length} etiquetas (${total} contactos actualizados).` };
}
