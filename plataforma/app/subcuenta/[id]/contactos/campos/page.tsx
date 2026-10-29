import { subcuentaVisible } from '@/lib/sesion';
import { camposDe } from '@/lib/crm/datos';
import { GestorCampos } from '@/components/crm/GestorCampos';

export const metadata = { title: 'Campos personalizados' };

export default async function PaginaCampos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  return <GestorCampos subId={id} campos={await camposDe(id)} soyAdmin={soyAdmin} />;
}
