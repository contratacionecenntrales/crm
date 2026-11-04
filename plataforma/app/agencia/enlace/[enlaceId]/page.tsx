import { exigirAgencia } from '@/lib/sesion';
import { VistaEnlace } from '@/components/shell/VistaEnlace';

export default async function PaginaEnlaceAgencia({ params }: { params: Promise<{ enlaceId: string }> }) {
  const { enlaceId } = await params;
  const { actual } = await exigirAgencia();
  return <VistaEnlace enlaceId={enlaceId} agenciaId={actual.agencia.id} subcuentaId={null} />;
}
