import { eur, estadoFacturaClass, formatFecha, formatHora } from "@/lib/intranet";
import type { Factura } from "./FacturacionTab";
import type { Cita } from "./AgendaTab";
import { estadoCitaClass } from "@/lib/intranet";

export function DashboardTab({
  facturas,
  citas,
  objetivo,
}: {
  facturas: Factura[];
  citas: Cita[];
  objetivo: number;
}) {
  const total = facturas.reduce((s, f) => s + Number(f.importe), 0);
  const pendientes = facturas.filter((f) => f.estado === "Pendiente").length;
  const progreso = objetivo > 0 ? Math.min(100, Math.round((total / objetivo) * 100)) : 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const citasHoy = citas.filter((c) => c.fecha_cita.slice(0, 10) === hoy);
  const proximas = citasHoy.length > 0 ? citasHoy : citas.slice(0, 3);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card p-5 glow-gold">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
            Facturación subida
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-brand text-glow-gold">
            {eur.format(total)}
          </p>
          <p className="mt-2 text-xs text-ink-500">{facturas.length} facturas registradas</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
            Citas agendadas
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-accent text-glow-violet">
            {citas.length}
          </p>
          <p className="mt-2 text-xs text-ink-500">{citasHoy.length} para hoy</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
            Objetivo trimestral
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-lime">{progreso}%</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-void">
            <div className="h-1.5 rounded-full bg-lime" style={{ width: `${progreso}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
            Facturas pendientes
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-amber">{pendientes}</p>
          <p className="mt-2 text-xs text-ink-500">por validar en admin</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink-100">Facturación reciente</h2>
          <div className="mt-4 divide-y divide-line">
            {facturas.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-100">
                    {f.concepto} — {f.cliente}
                  </p>
                  <p className="font-mono text-[11px] text-ink-500">
                    {formatFecha(f.fecha)} · {eur.format(Number(f.importe))}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${estadoFacturaClass[f.estado]}`}
                >
                  {f.estado}
                </span>
              </div>
            ))}
            {facturas.length === 0 && (
              <p className="py-6 text-sm text-ink-500">Sin facturación registrada todavía.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold text-ink-100">Agenda hoy</h2>
          <div className="mt-4 space-y-3">
            {proximas.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-card p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-brand">{formatHora(c.fecha_cita)}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${estadoCitaClass[c.estado]}`}
                  >
                    {c.estado}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-ink-100">{c.cliente}</p>
                {c.ubicacion && <p className="text-[11px] text-ink-500">{c.ubicacion}</p>}
              </div>
            ))}
            {proximas.length === 0 && (
              <p className="py-6 text-sm text-ink-500">No tienes citas registradas.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
