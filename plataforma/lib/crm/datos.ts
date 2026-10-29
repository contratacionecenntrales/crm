import 'server-only';
import { cache } from 'react';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Campo, Embudo, Etapa, Usuario } from './tipos';

export const camposDe = cache(async (subcuentaId: string): Promise<Campo[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('crm_campos')
    .select('id, clave, nombre, tipo, opciones, carpeta, orden')
    .eq('subcuenta_id', subcuentaId)
    .order('carpeta')
    .order('orden')
    .order('nombre');
  if (error) throw new Error(error.message);
  return (data ?? []) as Campo[];
});

export const asignablesDe = cache(async (subcuentaId: string): Promise<Usuario[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('usuarios_asignables', { p_subcuenta: subcuentaId });
  if (error) throw new Error(error.message);
  return (data ?? []) as Usuario[];
});

export const etiquetasDe = cache(async (subcuentaId: string): Promise<string[]> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('crm_etiquetas').select('nombre').eq('subcuenta_id', subcuentaId).order('nombre').limit(1000);
  return (data ?? []).map((e) => e.nombre as string);
});

export const embudosDe = cache(async (subcuentaId: string): Promise<Embudo[]> => {
  const supabase = await crearClienteServidor();
  const [e, s] = await Promise.all([
    supabase.from('crm_embudos').select('id, nombre, orden').eq('subcuenta_id', subcuentaId).order('orden').order('creado'),
    supabase.from('crm_etapas').select('id, embudo_id, nombre, orden').eq('subcuenta_id', subcuentaId).order('orden'),
  ]);
  if (e.error) throw new Error(e.error.message);
  const etapas = (s.data ?? []) as Etapa[];
  return (e.data ?? []).map((x) => ({ ...(x as Omit<Embudo, 'etapas'>), etapas: etapas.filter((y) => y.embudo_id === x.id) }));
});

export const nombreUsuario = (u: Usuario | undefined) => (u ? u.nombre || u.email.split('@')[0] : 'Sin asignar');

// Moneda de la agencia de la subcuenta (también para usuarios que no ven la agencia).
export const monedaDe = cache(async (subcuentaId: string): Promise<string> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('moneda_subcuenta', { p_subcuenta: subcuentaId });
  return (data as string) || 'EUR';
});
