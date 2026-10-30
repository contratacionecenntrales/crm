'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function GraficoMensajes({ datos }: { datos: { dia: string; entrantes: number; salientes: number; fallidos: number }[] }) {
  if (!datos.some((d) => d.entrantes || d.salientes || d.fallidos)) {
    return <p className="py-16 text-center text-sm text-tenue">Sin mensajes en este periodo.</p>;
  }
  const etiqueta = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
          <XAxis dataKey="dia" tickFormatter={etiqueta} tick={{ fontSize: 12, fill: '#667085' }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#667085' }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={(d) => etiqueta(String(d))} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="entrantes" name="Recibidos" stackId="a" fill="#53b1fd" radius={[0, 0, 0, 0]} />
          <Bar dataKey="salientes" name="Enviados" stackId="a" fill="#155eef" />
          <Bar dataKey="fallidos" name="Fallidos" stackId="a" fill="#f04438" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
