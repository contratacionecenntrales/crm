'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { estadoCita } from '@/app/subcuenta/[id]/calendarios/acciones';
import { estiloInputBase } from '@/components/ui/clases';
import { diaEn } from '@/lib/calendario/tiempo';
import { ESTADOS_CITA, estadoCita as infoEstado, nombrePersona, type Calendario, type Cita, type EstadoCita } from '@/lib/calendario/tipos';
import { nombreContacto, type Usuario } from '@/lib/crm/tipos';

function FilaCita({ subId, zona, c, cal, persona }: { subId: string; zona: string; c: Cita; cal?: Calendario; persona: string }) {
  const [estado, setEstado] = useState<EstadoCita>(c.estado);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const f = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: zona });
  const h = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: zona });
  const enCalendario = `/subcuenta/${subId}/calendarios?vista=semana&fecha=${diaEn(new Date(c.inicio), zona)}&cita=${c.id}`;
  return (
    <tr className={`border-t border-borde-fuerte ${pendiente ? 'opacity-60' : ''}`}>
      <td className="px-4 py-2">
        <Link href={enCalendario} className="font-medium text-primario-texto hover:underline">{c.titulo}</Link>
        {c.origen === 'reserva' && <span className="ml-2 rounded bg-[#f4f3ff] px-1.5 py-0.5 text-[11px] font-medium text-[#5925dc]">Reserva online</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className="block text-texto">{f.format(new Date(c.inicio))}</span>
        <span className="block text-xs text-tenue">{h.format(new Date(c.inicio))} – {h.format(new Date(c.fin))}</span>
      </td>
      <td className="px-4 py-2">
        <select
          value={estado}
          aria-label="Estado de la cita"
          className={`h-7 rounded-full border-0 px-2.5 text-xs font-medium ${infoEstado(estado).clase}`}
          onChange={(e) => {
            const nuevo = e.target.value as EstadoCita;
            const antes = estado;
            setEstado(nuevo);
            setError(null);
            iniciar(async () => {
              const r = await estadoCita(subId, c.id, nuevo);
              if (!r.ok) { setEstado(antes); setError(r.error ?? 'No se pudo cambiar.'); }
            });
          }}
        >
          {ESTADOS_CITA.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
        </select>
        {error && <span className="mt-1 block text-xs text-peligro">{error}</span>}
      </td>
      <td className="px-4 py-2">
        {c.contacto ? (
          <Link href={`/subcuenta/${subId}/contacto/${c.contacto.id}`} className="hover:text-primario-texto hover:underline">
            {nombreContacto(c.contacto)}
            {c.contacto.telefono && <span className="block text-xs text-tenue">{c.contacto.telefono}</span>}
          </Link>
        ) : <span className="text-tenue">—</span>}
      </td>
      <td className="px-4 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: cal?.color ?? '#98a2b3' }} />{cal?.nombre ?? '—'}
        </span>
      </td>
      <td className="px-4 py-2">{persona}</td>
      <td className="whitespace-nowrap px-4 py-2 text-tenue">{f.format(new Date(c.creado))}</td>
    </tr>
  );
}

export function ListaCitas({ subId, zona, citas, calendarios, usuarios }: {
  subId: string; zona: string; citas: Cita[]; calendarios: Calendario[]; usuarios: Usuario[];
}) {
  const porCal = new Map(calendarios.map((c) => [c.id, c]));
  return (
    <div className="overflow-x-auto rounded-lg border border-borde-fuerte bg-superficie">
      <table className="w-full min-w-[960px] text-left text-[13px] text-[#475467] dark:text-texto-2">
        <thead className="bg-superficie-2 text-xs font-medium text-[#475467] dark:text-texto-2">
          <tr>
            <th className="px-4 py-2.5 font-medium">Nombre de la cita</th>
            <th className="px-4 py-2.5 font-medium">Hora de la cita</th>
            <th className="px-4 py-2.5 font-medium">Estado de la cita</th>
            <th className="px-4 py-2.5 font-medium">Contacto</th>
            <th className="px-4 py-2.5 font-medium">Calendario</th>
            <th className="px-4 py-2.5 font-medium">Asignado a</th>
            <th className="px-4 py-2.5 font-medium">Creado el</th>
          </tr>
        </thead>
        <tbody>
          {citas.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">No hay citas que mostrar.</td></tr>
          ) : citas.map((c) => (
            <FilaCita key={c.id} subId={subId} zona={zona} c={c} cal={porCal.get(c.calendario_id)}
              persona={c.asignado_id ? nombrePersona(usuarios.find((u) => u.usuario_id === c.asignado_id)) : 'Sin asignar'} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Selectores de calendario y persona que cambian la URL.
export function FiltrosCitas({ calendarios, usuarios, calendario, persona }: {
  calendarios: Calendario[]; usuarios: Usuario[]; calendario: string; persona: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const q = useSearchParams();
  const cambiar = (k: string, v: string) => {
    const u = new URLSearchParams(q.toString());
    if (v) u.set(k, v); else u.delete(k);
    u.delete('pagina');
    router.push(`${ruta}?${u}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select value={calendario} onChange={(e) => cambiar('calendario', e.target.value)} aria-label="Calendario" className={`${estiloInputBase} w-48`}>
        <option value="">Todos los calendarios</option>
        {calendarios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <select value={persona} onChange={(e) => cambiar('persona', e.target.value)} aria-label="Asignado a" className={`${estiloInputBase} w-48`}>
        <option value="">Todo el equipo</option>
        {usuarios.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{nombrePersona(u)}</option>)}
      </select>
    </div>
  );
}
