import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { calendariosDe, horarioDe } from '@/lib/calendario/datos';
import { EditorCalendario } from '@/components/calendario/EditorCalendario';

export const metadata = { title: 'Editar calendario' };

export default async function PaginaEditarCalendario({ params }: { params: Promise<{ id: string; calId: string }> }) {
  const { id, calId } = await params;
  const base = `/subcuenta/${id}/calendarios/configuracion`;
  const [{ soyAdmin }, calendarios, usuarios, h] = await Promise.all([subcuentaVisible(id), calendariosDe(id), asignablesDe(id), headers()]);
  if (!soyAdmin) redirect(base);
  const cal = calendarios.find((c) => c.id === calId);
  if (!cal) notFound();
  const horario = await horarioDe(calId);
  const origen = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? ''}`;
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 font-sans">
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-medium text-texto-2 hover:text-primario-texto">
        <ArrowLeft className="size-4" /> Calendarios
      </Link>
      <EditorCalendario subId={id} calendario={cal} horario={horario} usuarios={usuarios} origen={origen} />
    </div>
  );
}
