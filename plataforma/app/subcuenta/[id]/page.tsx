import { redirect } from 'next/navigation';

export default async function InicioSubcuenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/subcuenta/${id}/configuracion`);
}
