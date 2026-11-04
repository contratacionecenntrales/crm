import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ajustesDe, secretosPuestos, serviciosHeredados } from '@/lib/conversaciones/datos';
import { Info } from 'lucide-react';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesCorreo } from '@/components/ajustes/Canales';

export const metadata = { title: 'Servicios de correo' };

export default async function PaginaCorreo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ soyAdmin }, ajustes, puestos, heredado] = await Promise.all([subcuentaVisible(id), ajustesDe(id), secretosPuestos(id), serviciosHeredados(id)]);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Servicios de correo" subtitulo={soyAdmin ? 'Elige cómo se envían los correos de Conversaciones.' : 'Solo un administrador puede cambiar estos ajustes.'} />
      {!ajustes.correo_proveedor && heredado.correo && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-[#b2ccff] bg-[#eff4ff] px-4 py-3 text-sm text-[#004eeb] dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" /> Ahora mismo los correos salen con el servicio de tu agencia{heredado.correo_remitente ? ` (${heredado.correo_remitente})` : ''}. Si configuras un proveedor aquí, se usará el tuyo.
        </p>
      )}
      <AjustesCorreo subId={id} ajustes={ajustes} puestos={puestos} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
