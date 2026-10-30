'use client';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronDown, Search } from 'lucide-react';
import { dinero } from '@/lib/formato';

const PALETA = ['#53b1fd', '#7a5af8', '#32d583', '#fdb022', '#f670c7', '#22ccee', '#98a2b3', '#f97066'];
const estiloTip = { background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 8, color: 'var(--texto)', fontSize: 12 };

function usarNavegar() {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  return (param: string, valor: string) => {
    const n = new URLSearchParams(sp.toString());
    n.set(param, valor);
    router.push(`${ruta}?${n.toString()}`, { scroll: false });
  };
}

// Desplegable de 220×32 con radio 4, como los de los widgets del original.
export function SelectorUrl({ param, valor, opciones, etiqueta }: { param: string; valor: string; opciones: { valor: string; texto: string }[]; etiqueta: string }) {
  const navegar = usarNavegar();
  return (
    <label className="relative block w-[220px] max-w-full">
      <select aria-label={etiqueta} value={valor} onChange={(e) => navegar(param, e.target.value)}
        className="h-8 w-full appearance-none truncate rounded border border-borde-fuerte bg-superficie py-1.5 pl-2 pr-7 text-sm text-texto shadow-xs">
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-tenue" />
    </label>
  );
}

// Botón «📅 Últimos 30 días ⌄» (36 px, radio 8) que en realidad es un select.
export function BotonPeriodo({ valor, opciones }: { valor: string; opciones: { valor: string; texto: string }[] }) {
  const navegar = usarNavegar();
  return (
    <label className="relative inline-flex h-9 items-center gap-2 rounded-lg border border-borde-fuerte bg-superficie pl-3.5 pr-9 text-sm font-semibold text-texto-2 shadow-xs hover:bg-superficie-2">
      <CalendarDays className="size-5" strokeWidth={1.75} />
      <span>{opciones.find((o) => o.valor === valor)?.texto}</span>
      <ChevronDown className="pointer-events-none absolute right-3 size-5" strokeWidth={1.75} />
      <select aria-label="Periodo" value={valor} onChange={(e) => navegar('r', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </label>
  );
}

export function SinDatos() {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-4 text-sm text-tenue">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#eff4ff] text-primario"><Search className="size-6" /></span>
      <span className="text-base text-texto-2">No se han encontrado datos</span>
    </div>
  );
}

export function Rosco({ datos, moneda }: { datos: { nombre: string; n: number; valor?: number; color?: string }[]; moneda?: string }) {
  const filas = datos.filter((d) => d.n > 0);
  if (!filas.length) return <SinDatos />;
  const total = filas.reduce((s, d) => s + d.n, 0);
  return (
    <div className="flex h-full items-center gap-6">
      <div className="relative size-[150px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={filas} dataKey="n" nameKey="nombre" innerRadius={58} outerRadius={73} startAngle={90} endAngle={-270} stroke="none">
              {filas.map((d, i) => <Cell key={d.nombre} fill={d.color ?? PALETA[i % PALETA.length]} />)}
            </Pie>
            <Tooltip contentStyle={estiloTip} formatter={(v: number, n: string, it) =>
              [`${v} (${Math.round((v / total) * 100)} %)${moneda && it.payload.valor !== undefined ? ` · ${dinero(it.payload.valor, moneda)}` : ''}`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-texto">{total}</span>
      </div>
      <ul className="space-y-2 text-xs text-texto">
        {filas.map((d, i) => (
          <li key={d.nombre} className="flex items-center gap-2">
            <span className="h-3 w-6 rounded-sm" style={{ background: d.color ?? PALETA[i % PALETA.length] }} />
            {d.nombre} - {d.n}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarrasValor({ datos, moneda }: { datos: { nombre: string; valor: number; color: string }[]; moneda: string }) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <XAxis type="number" tickFormatter={(v) => dinero(v, moneda)} tick={{ fill: 'var(--tenue)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="nombre" width={90} tick={{ fill: 'var(--tenue)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={estiloTip} cursor={{ fill: 'var(--superficie-2)' }} formatter={(v: number) => dinero(v, moneda)} />
          <Bar dataKey="valor" barSize={14} radius={[0, 3, 3, 0]}>
            {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Anillo de progreso con el porcentaje en el centro y un punto al final.
export function Indicador({ porcentaje }: { porcentaje: number }) {
  const r = 66;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, porcentaje));
  const ang = (p / 100) * 2 * Math.PI - Math.PI / 2;
  return (
    <svg viewBox="0 0 160 160" className="size-[150px]" role="img" aria-label={`${p} % de conversión`}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="#e0eaff" strokeWidth="10" />
      <circle cx="80" cy="80" r={r} fill="none" stroke="#53b1fd" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 80 80)" />
      <circle cx={80 + r * Math.cos(ang)} cy={80 + r * Math.sin(ang)} r="6" fill="#53b1fd" />
      <text x="80" y="88" textAnchor="middle" className="fill-[var(--texto)]" fontSize="24">{p}%</text>
    </svg>
  );
}

// Embudo en tabla, como el del original: etapa e importe, acumulado y
// conversión al paso siguiente.
export function EmbudoTabla({ datos, moneda }: { datos: { etapa: string; n: number; valor: number }[]; moneda: string }) {
  if (!datos.length) return <SinDatos />;
  const primero = datos[0]?.n || 0;
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(2)}%` : '0.00%');
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-separate border-spacing-y-1 text-[13px] text-texto">
        <thead>
          <tr className="text-left text-xs">
            <th className="font-normal" />
            <th className="w-24 px-2 text-center font-medium">Acumulativo</th>
            <th className="w-28 px-2 text-center font-medium">Conversión del siguiente paso</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d, i) => (
            <tr key={d.etapa}>
              <td className="bg-gray-100 px-3 py-3 dark:bg-gray-800" style={{ width: `${Math.max(40, 100 - i * (50 / Math.max(1, datos.length)))}%` }}>
                {i + 1}. {d.etapa}<br />{dinero(d.valor, moneda)} · {d.n}
              </td>
              <td className="bg-gray-100 px-2 text-center dark:bg-gray-800">{pct(d.n, primero)}</td>
              <td className="bg-gray-50 px-2 text-center dark:bg-gray-900">{i < datos.length - 1 ? pct(datos[i + 1].n, d.n) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
