import { headers } from 'next/headers';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { calendariosDe } from '@/lib/calendario/datos';
import { TablaCalendarios } from '@/components/calendario/TablaCalendarios';

export const metadata = { title: 'Configuración del calendario' };

export default async function PaginaConfigCalendarios({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ soyAdmin }, calendarios, usuarios, h] = await Promise.all([subcuentaVisible(id), calendariosDe(id), asignablesDe(id), headers()]);
  const origen = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? ''}`;
  return (
    <div className="space-y-4 p-4 font-sans">
      <div>
        <h2 className="text-lg font-semibold text-texto">Calendarios</h2>
        <p className="text-sm text-tenue">Cada calendario tiene su página pública de reservas, su horario y el equipo que atiende las citas.</p>
      </div>
      <TablaCalendarios subId={id} calendarios={calendarios} usuarios={usuarios} soyAdmin={soyAdmin} origen={origen} />
    </div>
  );
}
