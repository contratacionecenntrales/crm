import { subcuentaVisible } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { MENSAJE_RESENA } from '@/lib/reputacion/enviar';
import { PanelReputacion, type FilaResena } from '@/components/reputacion/PanelReputacion';

export const metadata = { title: 'Reputación' };

export default async function PaginaReputacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [{ data: a }, { data, error }] = await Promise.all([
    supabase.from('rep_ajustes').select('enlace_resena, umbral, mensaje, asunto').eq('subcuenta_id', id).maybeSingle(),
    supabase.from('rep_solicitudes').select('id, canal, estado, puntuacion, comentario, creado, valorada_en, contacto:crm_contactos(id, nombre, apellidos, email, telefono)')
      .eq('subcuenta_id', id).order('creado', { ascending: false }).limit(500),
  ]);
  if (error) throw new Error(error.message);
  const ajustes = { enlace_resena: (a?.enlace_resena as string) ?? '', umbral: (a?.umbral as number) ?? 4, mensaje: (a?.mensaje as string) ?? MENSAJE_RESENA, asunto: (a?.asunto as string) ?? '¿Qué tal fue tu experiencia con {{empresa.nombre}}?' };
  return <PanelReputacion subId={id} ajustes={ajustes} solicitudes={(data ?? []) as unknown as FilaResena[]} soyAdmin={soyAdmin} />;
}
