'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { pedirResena } from '@/lib/reputacion/enviar';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function ctx(sub: string) { if (!UUID.test(sub)) throw new Error('Identificador no válido.'); await usuarioActual(); return crearClienteServidor(); }

const esquema = z.object({
  enlace_resena: z.string().trim().max(500).refine((u) => u === '' || /^https:\/\/[^\s<>"]+$/.test(u), 'El enlace tiene que empezar por https://'),
  umbral: z.number().int().min(1).max(5),
  mensaje: z.string().trim().min(1, 'Escribe el mensaje').max(1000),
  asunto: z.string().max(300),
});
export type AjustesResena = z.infer<typeof esquema>;

export async function guardarAjustesResena(sub: string, datos: AjustesResena): Promise<Resultado> {
  try {
    const v = esquema.safeParse(datos);
    if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? 'Datos no válidos.' };
    const supabase = await ctx(sub);
    const { data, error } = await supabase.from('rep_ajustes').upsert({ subcuenta_id: sub, ...v.data, actualizado: new Date().toISOString() }).select('subcuenta_id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede cambiar esto.' };
    revalidatePath(`/subcuenta/${sub}/reputacion`);
    return { ok: true, mensaje: 'Ajustes guardados.' };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function buscarContactosResena(sub: string, q: string): Promise<{ id: string; nombre: string; email: string | null; telefono: string }[]> {
  try {
    const supabase = await ctx(sub);
    const t = q.trim().replace(/[%_,()]/g, ' ').slice(0, 60);
    let consulta = supabase.from('crm_contactos').select('id, nombre, apellidos, email, telefono').eq('subcuenta_id', sub).order('ultima_actividad', { ascending: false, nullsFirst: false }).limit(8);
    if (t) consulta = consulta.or(`nombre.ilike.%${t}%,apellidos.ilike.%${t}%,email.ilike.%${t}%,telefono.ilike.%${t}%`);
    const { data } = await consulta;
    return (data ?? []).map((c) => ({ id: c.id as string, nombre: `${c.nombre} ${c.apellidos}`.trim() || (c.email as string) || (c.telefono as string), email: c.email as string | null, telefono: c.telefono as string }));
  } catch { return []; }
}

export async function pedirResenaPanel(sub: string, contactoId: string, canal: 'email' | 'sms' | 'whatsapp'): Promise<Resultado> {
  try {
    if (!UUID.test(contactoId) || !['email', 'sms', 'whatsapp'].includes(canal)) return { ok: false, error: 'Datos no válidos.' };
    const supabase = await ctx(sub);
    const fallo = await pedirResena(supabase, sub, contactoId, canal);
    revalidatePath(`/subcuenta/${sub}/reputacion`);
    return fallo ? { ok: false, error: fallo } : { ok: true, mensaje: 'Solicitud enviada.' };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
