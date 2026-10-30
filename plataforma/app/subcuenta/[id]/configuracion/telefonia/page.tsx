import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ajustesDe, secretosPuestos } from '@/lib/conversaciones/datos';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesTwilio } from '@/components/ajustes/Canales';

export const metadata = { title: 'Integración telefónica' };

export default async function PaginaTelefonia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ soyAdmin }, ajustes, puestos] = await Promise.all([subcuentaVisible(id), ajustesDe(id), secretosPuestos(id)]);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Integración telefónica" subtitulo={soyAdmin ? 'Conecta Twilio para enviar y recibir SMS y WhatsApp desde Conversaciones.' : 'Solo un administrador puede cambiar estos ajustes.'} />
      <AjustesTwilio subId={id} ajustes={ajustes} tokenPuesto={puestos.twilio_token} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
