'use client';
import {
  CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PieChart as IconoTarta } from 'lucide-react';
import { dinero, mesCorto } from '@/lib/formato';

const COLOR = { nuevos: '#7a5af8', mrr: '#4e5ba6', ingresos: '#2e90fa' };
const PALETA = ['#2e90fa', '#7a5af8', '#12b76a', '#f79009', '#ee46bc', '#06aed4', '#667085'];

export function GraficoCrecimiento({ serie, moneda }: { serie: { mes: string; nuevos: number; mrr: number; ingresos: number }[]; moneda: string }) {
  const datos = serie.map((s) => ({ ...s, etiqueta: mesCorto(s.mes), mrr: Number(s.mrr), ingresos: Number(s.ingresos) }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--borde)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fill: 'var(--tenue)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="dinero" tick={{ fill: 'var(--tenue)', fontSize: 12 }} axisLine={false} tickLine={false} width={56}
            tickFormatter={(v) => dinero(v, moneda)} />
          <YAxis yAxisId="clientes" orientation="right" allowDecimals={false} tick={{ fill: 'var(--tenue)', fontSize: 12 }}
            axisLine={false} tickLine={false} width={32}
            label={{ value: 'Total de clientes', angle: 90, position: 'insideRight', fill: 'var(--tenue)', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 8, color: 'var(--texto)' }}
            formatter={(v: number, nombre: string) => (nombre === 'Nuevos clientes' ? v : dinero(v, moneda))}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line yAxisId="clientes" type="linear" dataKey="nuevos" name="Nuevos clientes" stroke={COLOR.nuevos} strokeWidth={2} dot={{ r: 4 }} />
          <Line yAxisId="dinero" type="linear" dataKey="mrr" name="MRR" stroke={COLOR.mrr} strokeWidth={2} dot={{ r: 4 }} />
          <Line yAxisId="dinero" type="linear" dataKey="ingresos" name="Ingresos totales" stroke={COLOR.ingresos} strokeWidth={2}
            dot={{ r: 4, shape: 'square' } as never} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoDistribucion({ datos, moneda }: { datos: { concepto: string; importe: number }[]; moneda: string }) {
  const filas = datos.map((d) => ({ ...d, importe: Number(d.importe) })).filter((d) => d.importe > 0);
  if (filas.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="flex items-center gap-4 rounded-lg border border-borde bg-superficie px-6 py-5 shadow-sm">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-superficie-2 text-tenue">
            <IconoTarta className="size-6" />
          </span>
          <span className="text-sm text-texto">Aún no hay datos disponibles</span>
        </div>
      </div>
    );
  }
  const total = filas.reduce((s, d) => s + d.importe, 0);
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={filas} dataKey="importe" nameKey="concepto" innerRadius="58%" outerRadius="80%" paddingAngle={2}>
            {filas.map((_, i) => (
              <Cell key={i} fill={PALETA[i % PALETA.length]} stroke="var(--superficie)" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 8, color: 'var(--texto)' }}
            formatter={(v: number) => `${dinero(v, moneda)} (${Math.round((v / total) * 100)} %)`}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
