import { subcuentaVisible } from '@/lib/sesion';
import { VistaEnlace } from '@/components/shell/VistaEnlace';

export default async function PaginaEnlaceSubcuenta({ params }: { params: Promise<{ id: string; enlaceId: string }> }) {
  const { id, enlaceId } = await params;
  await subcuentaVisible(id);
  return <VistaEnlace enlaceId={enlaceId} agenciaId={null} subcuentaId={id} />;
}
