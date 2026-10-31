import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesPago } from '@/components/pagos/AjustesPago';

export const metadata = { title: 'Configuración de pagos' };

export default async function PaginaConfigPagos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [a, s] = await Promise.all([
    supabase.from('pag_ajustes').select('moneda, prefijo, siguiente_numero, impuesto_defecto, pie').eq('subcuenta_id', id).maybeSingle(),
    supabase.rpc('pag_estado_secretos', { p_subcuenta: id }),
  ]);
  const ajustes = a.data ? { ...a.data, impuesto_defecto: Number(a.data.impuesto_defecto) } : { moneda: 'EUR', prefijo: 'FAC-', siguiente_numero: 1, impuesto_defecto: 21, pie: '' };
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Configuración de pagos" subtitulo={soyAdmin ? undefined : 'Solo un administrador puede cambiar estos ajustes.'} />
      <AjustesPago subId={id} ajustes={ajustes as never} estado={(s.data ?? { stripe_secreta: false, stripe_webhook: false }) as never} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
