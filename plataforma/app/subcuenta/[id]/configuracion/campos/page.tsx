import { subcuentaVisible } from '@/lib/sesion';
import { camposDe } from '@/lib/crm/datos';
import { GestorCampos } from '@/components/crm/GestorCampos';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';

export const metadata = { title: 'Campos personalizados' };

export default async function CamposAjustes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Campos personalizados" />
      <GestorCampos subId={id} campos={await camposDe(id)} soyAdmin={soyAdmin} />
    </ContenedorAjustes>
  );
}
