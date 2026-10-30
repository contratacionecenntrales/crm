import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ajustesDe, secretosPuestos } from '@/lib/conversaciones/datos';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesCorreo } from '@/components/ajustes/Canales';

export const metadata = { title: 'Servicios de correo' };

export default async function PaginaCorreo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ soyAdmin }, ajustes, puestos] = await Promise.all([subcuentaVisible(id), ajustesDe(id), secretosPuestos(id)]);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Servicios de correo" subtitulo={soyAdmin ? 'Elige cómo se envían los correos de Conversaciones.' : 'Solo un administrador puede cambiar estos ajustes.'} />
      <AjustesCorreo subId={id} ajustes={ajustes} puestos={puestos} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
