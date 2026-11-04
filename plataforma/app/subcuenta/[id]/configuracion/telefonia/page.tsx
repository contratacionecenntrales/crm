import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ajustesDe, secretosPuestos, serviciosHeredados } from '@/lib/conversaciones/datos';
import { Info } from 'lucide-react';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesTwilio } from '@/components/ajustes/Canales';

export const metadata = { title: 'Integración telefónica' };

export default async function PaginaTelefonia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ soyAdmin }, ajustes, puestos, heredado] = await Promise.all([subcuentaVisible(id), ajustesDe(id), secretosPuestos(id), serviciosHeredados(id)]);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Integración telefónica" subtitulo={soyAdmin ? 'Conecta Twilio para enviar y recibir SMS y WhatsApp desde Conversaciones.' : 'Solo un administrador puede cambiar estos ajustes.'} />
      {!ajustes.twilio_sid && heredado.twilio && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-[#b2ccff] bg-[#eff4ff] px-4 py-3 text-sm text-[#004eeb] dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" /> Tu agencia tiene una cuenta de Twilio: deja el SID y el token vacíos y pon solo tus números (comprados en esa cuenta) para enviar con ella.
        </p>
      )}
      <AjustesTwilio subId={id} ajustes={ajustes} tokenPuesto={puestos.twilio_token} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
