'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/errores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const leer = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function guardarChatWeb(subId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    if (!UUID.test(subId)) return { ok: false, error: 'Subcuenta no válida.' };
    const titulo = leer(fd, 'titulo');
    if (!titulo || titulo.length > 60) return { ok: false, error: 'El título es obligatorio (máximo 60 caracteres).' };
    const color = leer(fd, 'color').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) return { ok: false, error: 'Color no válido.' };
    const posicion = leer(fd, 'posicion');
    if (!['derecha', 'izquierda'].includes(posicion)) return { ok: false, error: 'Posición no válida.' };
    const dominios = [...new Set(leer(fd, 'dominios').split(/[\s,;]+/)
      .map((d) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''))
      .filter(Boolean))];
    if (dominios.length > 20) return { ok: false, error: 'Como mucho 20 dominios.' };
    const fila = {
      subcuenta_id: subId, titulo,
      activo: fd.get('activo') === 'on',
      subtitulo: leer(fd, 'subtitulo').slice(0, 120),
      saludo: leer(fd, 'saludo').slice(0, 300),
      color, posicion,
      pedir_telefono: fd.get('pedir_telefono') === 'on',
      aviso_legal: leer(fd, 'aviso_legal').slice(0, 400),
      dominios,
    };
    const supabase = await crearClienteServidor();
    const { data: previo } = await supabase.from('chat_widgets').select('subcuenta_id').eq('subcuenta_id', subId).maybeSingle();
    const { subcuenta_id: _id, ...cambios } = fila;
    const r = previo
      ? await supabase.from('chat_widgets').update(cambios).eq('subcuenta_id', subId).select('subcuenta_id')
      : await supabase.from('chat_widgets').insert(fila).select('subcuenta_id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede cambiar el chat web.' };
    revalidatePath(`/subcuenta/${subId}/configuracion/chat-web`);
    return { ok: true, mensaje: fila.activo ? 'Guardado. El chat ya aparece en tu web.' : 'Guardado. El chat está desactivado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renovarClaveChat(subId: string): Promise<Resultado> {
  try {
    if (!UUID.test(subId)) return { ok: false, error: 'Subcuenta no válida.' };
    const supabase = await crearClienteServidor();
    const { error } = await supabase.rpc('chat_renovar_clave', { p_subcuenta: subId });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath(`/subcuenta/${subId}/configuracion/chat-web`);
    return { ok: true, mensaje: 'Código renovado. Cambia el código pegado en tu web: el anterior ya no funciona.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
