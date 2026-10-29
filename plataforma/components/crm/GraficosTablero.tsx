'use client';
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { estiloInputBase } from '@/components/ui/clases';
import { dinero } from '@/lib/formato';

const PALETA = ['#2e90fa', '#7a5af8', '#12b76a', '#f79009', '#ee46bc', '#06aed4', '#667085', '#f04438'];
const estiloTip = { background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 8, color: 'var(--texto)' };

export function SelectorUrl({ param, valor, opciones, etiqueta, ancho = 'w-full' }: {
  param: string; valor: string; opciones: { valor: string; texto: string }[]; etiqueta: string; ancho?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  return (
    <select aria-label={etiqueta} value={valor} className={`${estiloInputBase} ${ancho}`}
      onChange={(e) => {
        const n = new URLSearchParams(sp.toString());
        n.set(param, e.target.value);
        router.push(`${ruta}?${n.toString()}`, { scroll: false });
      }}>
      {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
    </select>
  );
}

function SinDatos() {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-sm text-tenue">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primario-suave text-primario"><Search className="size-6" /></span>
      No se han encontrado datos
    </div>
  );
}

export function Rosco({ datos, moneda }: { datos: { nombre: string; n: number; valor?: number; color?: string }[]; moneda?: string }) {
  const filas = datos.filter((d) => d.n > 0);
  if (!filas.length) return <SinDatos />;
  const total = filas.reduce((s, d) => s + d.n, 0);
  return (
    <div className="grid h-full grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto]">
      <div className="relative h-52">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={filas} dataKey="n" nameKey="nombre" innerRadius="60%" outerRadius="85%" paddingAngle={2}>
              {filas.map((d, i) => <Cell key={d.nombre} fill={d.color ?? PALETA[i % PALETA.length]} stroke="var(--superficie)" />)}
            </Pie>
            <Tooltip contentStyle={estiloTip} formatter={(v: number, n: string, it) =>
              [`${v} (${Math.round((v / total) * 100)} %)${moneda && it.payload.valor !== undefined ? ` · ${dinero(it.payload.valor, moneda)}` : ''}`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{total}</span>
          <span className="text-xs text-tenue">total</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {filas.map((d, i) => (
          <li key={d.nombre} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: d.color ?? PALETA[i % PALETA.length] }} />
            <span className="flex-1">{d.nombre}</span>
            <span className="font-medium">{d.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Embudo({ datos, moneda }: { datos: { etapa: string; n: number; valor: number }[]; moneda: string }) {
  if (!datos.some((d) => d.n > 0)) return <SinDatos />;
  const max = Math.max(...datos.map((d) => d.n));
  return (
    <div style={{ height: Math.max(180, datos.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={datos.map((d, i) => ({ ...d, conv: i === 0 || !datos[0].n ? 100 : Math.round((d.n / datos[0].n) * 100) }))} layout="vertical" margin={{ left: 8, right: 48 }}>
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis type="category" dataKey="etapa" width={120} tick={{ fill: 'var(--texto)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={estiloTip} cursor={{ fill: 'var(--superficie-2)' }}
            formatter={(v: number, _n, it) => [`${v} oportunidades · ${dinero(it.payload.valor, moneda)} · ${it.payload.conv} % de la primera etapa`, 'Han llegado']} />
          <Bar dataKey="n" radius={[0, 6, 6, 0]}>
            {datos.map((_, i) => <Cell key={i} fill={PALETA[0]} fillOpacity={1 - i * (0.6 / Math.max(1, datos.length))} />)}
            <LabelList dataKey="n" position="right" fill="var(--texto)" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
