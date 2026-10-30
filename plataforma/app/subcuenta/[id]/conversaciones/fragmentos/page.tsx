import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { GestorFragmentos } from '@/components/conversaciones/GestorFragmentos';
import type { Fragmento } from '@/lib/conversaciones/tipos';

export const metadata = { title: 'Fragmentos' };

export default async function PaginaFragmentos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('conv_fragmentos').select('id, nombre, cuerpo').eq('subcuenta_id', id).order('nombre').limit(500);
  if (error) throw new Error(error.message);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 font-sans">
      <div>
        <h2 className="text-lg font-semibold text-texto">Fragmentos</h2>
        <p className="text-sm text-tenue">Respuestas guardadas que se insertan con un clic al escribir en Conversaciones.</p>
      </div>
      <GestorFragmentos subId={id} fragmentos={(data ?? []) as Fragmento[]} />
    </div>
  );
}
