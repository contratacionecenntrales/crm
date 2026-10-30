'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { diasDeVista, inicioMes, nombreMes, sumarMeses, type Dia } from '@/lib/calendario/tiempo';

const INICIALES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// Calendario mensual pequeño: selector de fecha y página de reserva.
export function MiniMes({ seleccionado, hoy, alElegir, habilitado, conHuecos, alCambiarMes, grande, mesInicial }: {
  seleccionado: Dia | null;
  hoy: Dia;
  alElegir: (d: Dia) => void;
  habilitado?: (d: Dia) => boolean;
  conHuecos?: (d: Dia) => boolean;
  alCambiarMes?: (primero: Dia) => void;
  grande?: boolean;
  mesInicial?: Dia;
}) {
  const [mes, setMes] = useState(inicioMes(mesInicial ?? seleccionado ?? hoy));
  const cambiar = (n: 1 | -1) => {
    const m = sumarMeses(mes, n);
    setMes(m);
    alCambiarMes?.(m);
  };
  const dias = diasDeVista('mes', mes);
  const celda = grande ? 'size-11 text-[15px]' : 'size-8 text-[13px]';
  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => cambiar(-1)} aria-label="Mes anterior" className="rounded-md p-1.5 text-texto-2 hover:bg-superficie-2">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-texto">{nombreMes(mes)}</span>
        <button type="button" onClick={() => cambiar(1)} aria-label="Mes siguiente" className="rounded-md p-1.5 text-texto-2 hover:bg-superficie-2">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-1">
        {INICIALES.map((i, n) => <span key={n} className="pb-1 text-xs font-medium text-tenue">{i}</span>)}
        {dias.map((d) => {
          const fuera = d.slice(0, 7) !== mes.slice(0, 7);
          const activo = habilitado ? habilitado(d) : true;
          const sel = d === seleccionado;
          const libre = conHuecos?.(d);
          return (
            <button
              key={d}
              type="button"
              disabled={!activo}
              onClick={() => alElegir(d)}
              aria-pressed={sel}
              aria-label={d}
              className={`relative flex ${celda} items-center justify-center rounded-full ${
                sel ? 'bg-primario font-semibold text-white'
                : libre ? 'bg-primario-suave font-semibold text-primario-texto hover:bg-primario hover:text-white'
                : d === hoy ? 'font-semibold text-primario'
                : fuera ? 'text-[#d0d5dd]' : 'text-texto-2 hover:bg-superficie-2'
              } disabled:cursor-default disabled:bg-transparent disabled:font-normal disabled:text-[#d0d5dd]`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
