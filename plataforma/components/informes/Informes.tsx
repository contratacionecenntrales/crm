'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { dinero } from '@/lib/formato';

export interface DatosInforme {
  contactos: { nuevos: number; total: number; por_dia: { dia: string; n: number }[]; por_fuente: { fuente: string; n: number }[] };
  oportunidades: { creadas: number; valor_creado: number; ganadas: number; valor_ganado: number; perdidas: number; abiertas: number; valor_abierto: number };
  etapas: { embudo: string; etapa: string; n: number; valor: number }[];
  citas: { total: number; online: number; presentado: number; no_presentado: number; canceladas: number; pendientes: number };
  facturacion: { emitidas: number; facturado: number; cobrado: number; pendiente: number; moneda: string };
  mensajes: { canal: string; entrantes: number; salientes: number; ia: number }[];
  embudos: { nombre: string; visitas: number; envios: number }[];
  marketing: { enviados: number; fallidos: number; bajas: number };
  resenas: { pedidas: number; valoradas: number; media: number | null };
  ia: { respuestas: number; tokens: number };
}

const CANAL: Record<string, string> = { email: 'Correo', sms: 'SMS', whatsapp: 'WhatsApp', chat: 'Chat web' };
const n = (x: number) => Number(x ?? 0).toLocaleString('es-ES');
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const corto = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-borde bg-superficie p-4">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-texto">{valor}</p>
      {detalle && <p className="mt-0.5 truncate text-xs text-texto-2">{detalle}</p>}
    </div>
  );
}

function Panel({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-lg border border-borde bg-superficie p-4 ${className}`}><h2 className="mb-3 text-sm font-semibold text-texto">{titulo}</h2>{children}</section>;
}

const Vacio = () => <p className="py-8 text-center text-sm text-tenue">Sin datos en este periodo.</p>;

// Columnas por día (una serie: el título la nombra, sin leyenda). Días sin datos = 0.
function Columnas({ datos, desde, hasta }: { datos: { dia: string; n: number }[]; desde: string; hasta: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const mapa = new Map(datos.map((d) => [d.dia, d.n]));
  const dias: { dia: string; n: number }[] = [];
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= Date.parse(`${hasta}T12:00:00Z`); t += 864e5) {
    const dia = new Date(t).toISOString().slice(0, 10);
    dias.push({ dia, n: mapa.get(dia) ?? 0 });
  }
  const max = Math.max(1, ...dias.map((d) => d.n));
  const tope = Math.ceil(max / 4) * 4 || 4;
  if (!datos.length) return <Vacio />;
  return (
    <div>
      <div className="relative flex h-44 items-end gap-[2px] border-b border-borde pl-7" onMouseLeave={() => setActivo(null)}>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute left-7 right-0 border-t border-borde/60" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-7 -top-2 w-6 text-right text-[10px] text-tenue">{Math.round(tope * f)}</span>
          </div>
        ))}
        {dias.map((d, i) => (
          <button key={d.dia} type="button" className="relative flex h-full min-w-0 flex-1 items-end focus:outline-none" onMouseEnter={() => setActivo(i)} onFocus={() => setActivo(i)}
            aria-label={`${corto(d.dia)}: ${d.n} contacto(s)`}>
            <span className="block w-full rounded-t bg-primario transition-opacity" style={{ height: `${(d.n / tope) * 100}%`, minHeight: d.n ? 2 : 0, opacity: activo === null || activo === i ? 1 : 0.45 }} />
            {activo === i && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-borde bg-superficie px-2 py-1 text-xs text-texto shadow-lg">
                <span className="text-tenue">{corto(d.dia)}</span> · <b>{d.n}</b>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between pl-7 text-[10px] text-tenue"><span>{corto(dias[0].dia)}</span><span>{corto(dias[dias.length - 1].dia)}</span></div>
    </div>
  );
}

// Barras horizontales con la etiqueta y el valor en texto (nunca solo color).
function Barras({ filas }: { filas: { etiqueta: string; valor: number; texto?: string }[] }) {
  if (!filas.length) return <Vacio />;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.etiqueta} className="group" title={`${f.etiqueta}: ${f.texto ?? n(f.valor)}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-texto-2">{f.etiqueta}</span><span className="shrink-0 font-medium text-texto">{f.texto ?? n(f.valor)}</span></div>
          <div className="h-2 rounded-full bg-superficie-2"><div className="h-full rounded-full bg-primario group-hover:opacity-80" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Informes({ subId, desde, hasta, hoy, d }: { subId: string; desde: string; hasta: string; hoy: string; d: DatosInforme }) {
  const router = useRouter();
  const [f, setF] = useState({ desde, hasta });
  const ir = (a: string, b: string) => router.push(`/subcuenta/${subId}/informes?desde=${a}&hasta=${b}`);
  const menos = (k: number) => new Date(Date.parse(`${hoy}T12:00:00Z`) - k * 864e5).toISOString().slice(0, 10);
  const m = d.facturacion.moneda;
  const op = d.oportunidades;
  const citasCerradas = d.citas.presentado + d.citas.no_presentado;
  const visitas = d.embudos.reduce((t, e) => t + Number(e.visitas), 0);
  const envios = d.embudos.reduce((t, e) => t + Number(e.envios), 0);

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Informes</h1>
          <p className="text-xs text-tenue">Del {corto(desde)} al {corto(hasta)}. Las cifras de «abiertas» y «pendiente» son de hoy.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {[[7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '12 meses']].map(([k, t]) => {
            const a = menos((k as number) - 1);
            return <button key={k} onClick={() => ir(a, hoy)} aria-pressed={desde === a && hasta === hoy} className={`${estilosBoton.secundario} ${desde === a && hasta === hoy ? 'border-primario text-primario-texto' : ''}`}>{t}</button>;
          })}
          <form className="flex items-end gap-1" onSubmit={(e) => { e.preventDefault(); ir(f.desde, f.hasta); }}>
            <input type="date" value={f.desde} max={f.hasta} onChange={(e) => setF({ ...f, desde: e.target.value })} aria-label="Desde" className={`${estiloInput} w-36`} />
            <input type="date" value={f.hasta} max={hoy} onChange={(e) => setF({ ...f, hasta: e.target.value })} aria-label="Hasta" className={`${estiloInput} w-36`} />
            <button className={estilosBoton.secundario}>Ver</button>
          </form>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta titulo="Contactos nuevos" valor={n(d.contactos.nuevos)} detalle={`${n(d.contactos.total)} en total`} />
        <Tarjeta titulo="Oportunidades ganadas" valor={dinero(op.valor_ganado, m)} detalle={`${n(op.ganadas)} ganadas · ${n(op.perdidas)} perdidas`} />
        <Tarjeta titulo="Cobrado" valor={dinero(d.facturacion.cobrado, m)} detalle={`${dinero(d.facturacion.pendiente, m)} pendiente de cobro`} />
        <Tarjeta titulo="Citas" valor={n(d.citas.total)} detalle={`Asistencia ${pct(d.citas.presentado, citasCerradas)} · ${n(d.citas.online)} online`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Contactos nuevos por día" className="lg:col-span-2"><Columnas datos={d.contactos.por_dia} desde={desde} hasta={hasta} /></Panel>
        <Panel titulo="De dónde vienen"><Barras filas={d.contactos.por_fuente.map((x) => ({ etiqueta: x.fuente, valor: x.n }))} /></Panel>
        <Panel titulo="Oportunidades abiertas por etapa (valor)" className="lg:col-span-2">
          <Barras filas={d.etapas.map((x) => ({ etiqueta: `${x.embudo} › ${x.etapa}`, valor: Number(x.valor), texto: `${dinero(Number(x.valor), m)} · ${n(x.n)}` }))} />
          <p className="mt-3 text-xs text-tenue">{n(op.abiertas)} abiertas por {dinero(op.valor_abierto, m)} · {n(op.creadas)} creadas en el periodo ({dinero(op.valor_creado, m)})</p>
        </Panel>
        <Panel titulo="Citas">
          <Barras filas={[['Se presentó', d.citas.presentado], ['No se presentó', d.citas.no_presentado], ['Canceladas', d.citas.canceladas], ['Pendientes', d.citas.pendientes]].map(([e, v]) => ({ etiqueta: e as string, valor: v as number }))} />
        </Panel>
        <Panel titulo="Conversaciones por canal">
          {d.mensajes.length === 0 ? <Vacio /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-tenue"><tr><th className="pb-2 font-medium">Canal</th><th className="pb-2 text-right font-medium">Recibidos</th><th className="pb-2 text-right font-medium">Enviados</th><th className="pb-2 text-right font-medium">Por IA</th></tr></thead>
              <tbody className="divide-y divide-borde">
                {d.mensajes.map((x) => <tr key={x.canal}><td className="py-1.5 text-texto-2">{CANAL[x.canal] ?? x.canal}</td><td className="py-1.5 text-right text-texto">{n(x.entrantes)}</td><td className="py-1.5 text-right text-texto">{n(x.salientes)}</td><td className="py-1.5 text-right text-texto-2">{n(x.ia)}</td></tr>)}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel titulo="Embudos (visitas)">
          <Barras filas={d.embudos.map((x) => ({ etiqueta: x.nombre, valor: Number(x.visitas), texto: `${n(x.visitas)} · ${pct(Number(x.envios), Number(x.visitas))} convierte` }))} />
          {d.embudos.length > 0 && <p className="mt-3 text-xs text-tenue">{n(visitas)} visitas · {n(envios)} formularios · {pct(envios, visitas)} de conversión</p>}
        </Panel>
        <Panel titulo="Facturación, marketing, reseñas e IA">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            {[['Facturado', dinero(d.facturacion.facturado, m)], ['Facturas emitidas', n(d.facturacion.emitidas)],
              ['Campañas enviadas', n(d.marketing.enviados)], ['Bajas', n(d.marketing.bajas)],
              ['Reseñas valoradas', `${n(d.resenas.valoradas)} de ${n(d.resenas.pedidas)}`], ['Nota media', d.resenas.media ? `${Number(d.resenas.media).toFixed(1)} / 5` : '—'],
              ['Respuestas de IA', n(d.ia.respuestas)], ['Tokens de IA', n(d.ia.tokens)]].map(([t, v]) => (
              <div key={t} className="min-w-0"><dt className="text-xs text-tenue">{t}</dt><dd className="truncate font-medium text-texto">{v}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
      <details className="mt-4 rounded-lg border border-borde bg-superficie p-4 text-sm">
        <summary className="cursor-pointer font-medium text-texto">Ver los contactos por día en tabla</summary>
        <table className="mt-3 w-full max-w-sm text-sm"><tbody className="divide-y divide-borde">
          {d.contactos.por_dia.length === 0 ? <tr><td className="py-1 text-tenue">Sin datos.</td></tr> : d.contactos.por_dia.map((x) => <tr key={x.dia}><td className="py-1 text-texto-2">{corto(x.dia)}</td><td className="py-1 text-right text-texto">{n(x.n)}</td></tr>)}
        </tbody></table>
      </details>
    </div>
  );
}
