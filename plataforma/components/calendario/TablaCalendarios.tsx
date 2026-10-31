'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { alternarCalendario, borrarCalendario, crearCalendarioRapido } from '@/app/subcuenta/[id]/calendarios/acciones';
import { Interruptor } from '@/components/ajustes/Piezas';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { duracionTexto } from '@/lib/calendario/tiempo';
import { nombrePersona, type Calendario } from '@/lib/calendario/tipos';
import type { Usuario } from '@/lib/crm/tipos';

export function BotonCopiar({ texto, etiqueta = 'Copiar enlace' }: { texto: string; etiqueta?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" title={etiqueta} aria-label={etiqueta}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setHecho(true);
          setTimeout(() => setHecho(false), 1500);
        } catch {
          prompt('Copia el texto:', texto);
        }
      }}
      className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto">
      {hecho ? <Check className="size-4 text-exito" /> : <Copy className="size-4" />}
    </button>
  );
}

function Fila({ subId, c, usuarios, soyAdmin, origen }: { subId: string; c: Calendario; usuarios: Usuario[]; soyAdmin: boolean; origen: string }) {
  const [activo, setActivo] = useState(c.activo);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const enlace = `${origen}/reservar/${c.slug}`;
  const equipo = c.equipo.map((u) => nombrePersona(usuarios.find((x) => x.usuario_id === u))).join(', ');
  return (
    <tr className={`border-t border-borde-fuerte ${pendiente ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
          {soyAdmin ? (
            <Link href={`/subcuenta/${subId}/calendarios/configuracion/${c.id}`} className="font-medium text-texto hover:text-primario-texto">{c.nombre}</Link>
          ) : <span className="font-medium text-texto">{c.nombre}</span>}
        </div>
        {error && <p className="mt-1 text-xs text-peligro">{error}</p>}
      </td>
      <td className="px-4 py-3">{c.tipo === 'ronda' ? 'Por turnos (round robin)' : 'Personal'}</td>
      <td className="px-4 py-3">{duracionTexto(c.duracion_min)}</td>
      <td className="max-w-[220px] truncate px-4 py-3" title={equipo}>{equipo || <span className="text-tenue">Sin equipo</span>}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <code className="max-w-[220px] truncate rounded bg-superficie-2 px-1.5 py-0.5 text-xs">/reservar/{c.slug}</code>
          <BotonCopiar texto={enlace} />
          <a href={enlace} target="_blank" rel="noreferrer" aria-label="Abrir página de reserva" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto">
            <ExternalLink className="size-4" />
          </a>
        </div>
      </td>
      <td className="px-4 py-3">
        <Interruptor
          checked={activo}
          disabled={!soyAdmin || pendiente}
          etiqueta={activo ? 'Activo' : 'Inactivo'}
          onChange={(v) => {
            setActivo(v);
            iniciar(async () => {
              const r = await alternarCalendario(subId, c.id, v);
              if (!r.ok) { setActivo(!v); setError(r.error ?? null); }
            });
          }}
        />
      </td>
      <td className="px-4 py-3 text-right">
        {soyAdmin && (
          <div className="flex justify-end gap-1">
            <Link href={`/subcuenta/${subId}/calendarios/configuracion/${c.id}`} aria-label="Editar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto">
              <Pencil className="size-4" />
            </Link>
            <button type="button" aria-label="Borrar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"
              onClick={() => confirm(`¿Borrar «${c.nombre}»? Se borrarán también todas sus citas. Si solo quieres dejar de recibir reservas, desactívalo.`)
                && iniciar(async () => { const r = await borrarCalendario(subId, c.id); if (!r.ok) setError(r.error ?? null); })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function TablaCalendarios({ subId, calendarios, usuarios, soyAdmin, origen }: {
  subId: string; calendarios: Calendario[]; usuarios: Usuario[]; soyAdmin: boolean; origen: string;
}) {
  const [crear, setCrear] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-borde-fuerte bg-superficie">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-medium text-texto">{calendarios.length} {calendarios.length === 1 ? 'calendario' : 'calendarios'}</span>
          {soyAdmin && (
            <button type="button" onClick={() => setCrear(true)} className={estilosBoton.primario}><Plus className="size-4" /> Crear calendario</button>
          )}
        </div>
        <table className="w-full min-w-[900px] text-left text-[13px] text-[#475467] dark:text-texto-2">
          <thead className="bg-superficie-2 text-xs text-[#475467] dark:text-texto-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium">Duración</th>
              <th className="px-4 py-2.5 font-medium">Equipo</th>
              <th className="px-4 py-2.5 font-medium">Enlace de reserva</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {calendarios.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">
                {soyAdmin ? 'Todavía no hay calendarios. Crea el primero.' : 'Todavía no hay calendarios. Un administrador tiene que crearlos.'}
              </td></tr>
            ) : calendarios.map((c) => <Fila key={c.id} subId={subId} c={c} usuarios={usuarios} soyAdmin={soyAdmin} origen={origen} />)}
          </tbody>
        </table>
      </div>
      <Modal abierto={crear} alCerrar={() => setCrear(false)} titulo="Crear calendario" ancho="max-w-md">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          iniciar(async () => {
            const r = await crearCalendarioRapido(subId, nombre);
            if (!r.ok) setError(r.error ?? 'No se pudo crear.');
            else router.push(`/subcuenta/${subId}/calendarios/configuracion/${r.id}`);
          });
        }}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">Nombre del calendario</span>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} placeholder="Ej. Consulta inicial" className={estiloInput} />
          </label>
          <p className="text-xs text-tenue">Se crea con un horario de lunes a viernes de 9:00 a 17:00 y citas de 30 minutos. Después podrás cambiarlo todo.</p>
          {error && <Aviso estado={{ ok: false, error }} />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCrear(false)} className={estilosBoton.secundario}>Cancelar</button>
            <button disabled={pendiente} className={estilosBoton.primario}>Crear y configurar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
