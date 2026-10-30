'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { borrarCita, guardarCita, huecosDelDia } from '@/app/subcuenta/[id]/calendarios/acciones';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { diaEn, horaEn, sumarMinutosHora, type Dia } from '@/lib/calendario/tiempo';
import { ESTADOS_CITA, nombrePersona, type Calendario, type Cita } from '@/lib/calendario/tipos';
import type { Usuario } from '@/lib/crm/tipos';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

export interface PresetCita { fecha: Dia; hora?: string; calendarioId?: string; contacto?: Cita['contacto'] }

export function FormularioCita({ subId, zona, cita, preset, calendarios, usuarios, yo, alGuardar, alBorrar }: {
  subId: string;
  zona: string;
  cita?: Cita | null;
  preset?: PresetCita;
  calendarios: Calendario[];
  usuarios: Usuario[];
  yo: string;
  alGuardar: (id: string) => void;
  alBorrar?: () => void;
}) {
  const [estado, accion] = useActionState(guardarCita.bind(null, subId, cita?.id ?? null), null);
  const activos = calendarios.filter((c) => c.activo || c.id === cita?.calendario_id);
  const [calId, setCalId] = useState(cita?.calendario_id ?? preset?.calendarioId ?? activos[0]?.id ?? '');
  const cal = calendarios.find((c) => c.id === calId);
  const [fecha, setFecha] = useState<Dia>(cita ? diaEn(new Date(cita.inicio), zona) : preset?.fecha ?? diaEn(new Date(), zona));
  const [modo, setModo] = useState<'libre' | 'manual'>(cita || preset?.hora ? 'manual' : 'libre');
  const [inicio, setInicio] = useState(cita ? horaEn(new Date(cita.inicio), zona) : preset?.hora ?? '');
  const [fin, setFin] = useState(cita ? horaEn(new Date(cita.fin), zona)
    : preset?.hora ? sumarMinutosHora(preset.hora, cal?.duracion_min ?? 30) ?? '23:59' : '');
  const porDefecto = cal?.equipo.length ? (cal.equipo.includes(yo) ? yo : cal.equipo[0]) : yo;
  const [asignado, setAsignado] = useState(cita ? cita.asignado_id ?? '' : porDefecto);
  const [huecos, setHuecos] = useState<{ hora: string; usuarios: string[] }[] | null>(null);
  const [cargando, iniciar] = useTransition();
  const [borrando, iniciarBorrado] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  useEffect(() => {
    if (estado?.ok && estado.id) alGuardar(estado.id);
  }, [estado, alGuardar]);

  useEffect(() => {
    if (!calId || !fecha) return;
    let vivo = true;
    iniciar(async () => {
      const r = await huecosDelDia(subId, calId, fecha);
      if (vivo) setHuecos(r);
    });
    return () => { vivo = false; };
  }, [subId, calId, fecha]);

  const elegirHueco = (h: string) => {
    setInicio(h);
    setFin(sumarMinutosHora(h, cal?.duracion_min ?? 30) ?? '23:59');
    const libres = huecos?.find((x) => x.hora === h)?.usuarios ?? [];
    if (libres.length && !libres.includes(asignado)) setAsignado(libres[0]);
  };

  // Equipo del calendario primero, luego el resto de la subcuenta.
  const opcionesPersona = useMemo(() => {
    const equipo = new Set(cal?.equipo ?? []);
    return [...usuarios].sort((a, b) => Number(equipo.has(b.usuario_id)) - Number(equipo.has(a.usuario_id)));
  }, [usuarios, cal]);

  if (!activos.length) {
    return <p className="text-sm text-tenue">No hay ningún calendario activo. Crea uno en Configuración del calendario.</p>;
  }

  return (
    <form action={accion} className="space-y-4">
      {cita && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tenue">
          <span>{cita.origen === 'reserva' ? 'Reservada por el cliente desde la página pública' : 'Creada por el equipo'}</span>
          <span>Creada {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: zona }).format(new Date(cita.creado))}</span>
          {cita.contacto && (
            <Link href={`/subcuenta/${subId}/contacto/${cita.contacto.id}`} className="font-medium text-primario hover:underline">Ver contacto</Link>
          )}
        </div>
      )}
      <label className="block">
        <span className={etiqueta}>Calendario</span>
        <select name="calendario_id" value={calId} onChange={(e) => setCalId(e.target.value)} className={estiloInput} required>
          {activos.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.activo ? '' : ' (inactivo)'}</option>)}
        </select>
      </label>
      <div>
        <span className={etiqueta}>Contacto</span>
        <SelectorContacto subId={subId} name="contacto_id" inicial={cita?.contacto ?? preset?.contacto ?? null} />
      </div>
      <label className="block">
        <span className={etiqueta}>Título de la cita</span>
        <input name="titulo" defaultValue={cita?.titulo} maxLength={200} placeholder="Si lo dejas vacío se usa el nombre del contacto" className={estiloInput} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className={etiqueta}>Fecha</span>
          <input type="date" name="fecha" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className={estiloInput} required />
        </label>
        <div>
          <span className={etiqueta}>Hora</span>
          <div className="inline-flex h-8 overflow-hidden rounded border border-borde-fuerte text-sm">
            {(['libre', 'manual'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={`px-3 ${modo === m ? 'bg-primario-suave font-medium text-primario-texto' : 'bg-superficie text-texto-2 hover:bg-superficie-2'}`}>
                {m === 'libre' ? 'Horas libres' : 'Personalizada'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modo === 'libre' ? (
        <div>
          {cargando || huecos === null ? (
            <p className="flex items-center gap-2 text-sm text-tenue"><Loader2 className="size-4 animate-spin" /> Buscando horas libres…</p>
          ) : huecos.length === 0 ? (
            <p className="text-sm text-tenue">No quedan horas libres ese día según el horario del calendario. Usa «Personalizada» para forzar una hora.</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {huecos.map((h) => (
                <button key={h.hora} type="button" onClick={() => elegirHueco(h.hora)}
                  className={`h-8 rounded-lg border px-3 text-sm font-medium ${inicio === h.hora ? 'border-primario bg-primario text-white' : 'border-borde-fuerte text-texto-2 hover:border-primario hover:text-primario'}`}>
                  {h.hora}
                </button>
              ))}
            </div>
          )}
          {inicio && <p className="mt-2 text-xs text-tenue">De {inicio} a {fin}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={etiqueta}>Desde</span>
            <input type="time" value={inicio} required className={estiloInput}
              onChange={(e) => { const v = e.target.value; setInicio(v); if (v && (!fin || fin <= v)) setFin(sumarMinutosHora(v, cal?.duracion_min ?? 30) ?? '23:59'); }} />
          </label>
          <label className="block">
            <span className={etiqueta}>Hasta</span>
            <input type="time" value={fin} required onChange={(e) => setFin(e.target.value)} className={estiloInput} />
          </label>
        </div>
      )}
      <input type="hidden" name="hora_inicio" value={inicio} />
      <input type="hidden" name="hora_fin" value={fin} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Asignado a</span>
          <select name="asignado_id" value={asignado} onChange={(e) => setAsignado(e.target.value)} className={estiloInput}>
            <option value="">Sin asignar</option>
            {opcionesPersona.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{nombrePersona(u)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Estado</span>
          <select name="estado" defaultValue={cita?.estado ?? 'confirmada'} className={estiloInput}>
            {ESTADOS_CITA.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={etiqueta}>Ubicación</span>
        <input key={calId} name="ubicacion" defaultValue={cita?.ubicacion ?? cal?.ubicacion ?? ''} maxLength={500}
          placeholder="Dirección, enlace de videollamada o teléfono" className={estiloInput} />
      </label>
      <label className="block">
        <span className={etiqueta}>Notas</span>
        <textarea name="notas" defaultValue={cita?.notas} rows={3} maxLength={5000} className={estiloArea} />
      </label>

      <Aviso estado={estado} />
      {errorBorrar && <Aviso estado={{ ok: false, error: errorBorrar }} />}
      <div className="flex items-center justify-between gap-2 border-t pt-4">
        {cita && alBorrar ? (
          <button type="button" disabled={borrando} className={`${estilosBoton.fantasma} text-peligro hover:text-peligro`}
            onClick={() => confirm('¿Borrar esta cita? Si solo no va a venir, mejor cámbiala a «Cancelada».') && iniciarBorrado(async () => {
              const r = await borrarCita(subId, cita.id);
              if (r.ok) alBorrar(); else setErrorBorrar(r.error ?? 'No se pudo borrar.');
            })}>
            <Trash2 className="size-4" /> Borrar
          </button>
        ) : <span />}
        <BotonEnvio>{cita ? 'Guardar' : 'Reservar cita'}</BotonEnvio>
      </div>
    </form>
  );
}
