import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  eur,
  estadoComisionClass,
  estadoLiquidacionClass,
  formatFecha,
  type EstadoComision,
  type EstadoLiquidacion,
} from "@/lib/intranet";

export type Comision = {
  id: string;
  factura_id: string;
  user_id: string;
  concepto: string;
  importe: number;
  porcentaje: number;
  estado: EstadoComision;
  liquidacion_id: string | null;
  created_at: string;
};

export type Liquidacion = {
  id: string;
  user_id: string;
  importe_total: number;
  estado: EstadoLiquidacion;
  created_at: string;
  pagada_at: string | null;
};

export function LiquidacionesTab({
  comisiones,
  liquidaciones,
  userId,
  esAdmin,
  comerciales,
}: {
  comisiones: Comision[];
  liquidaciones: Liquidacion[];
  userId: string;
  esAdmin: boolean;
  comerciales: Record<string, string>;
}) {
  const qc = useQueryClient();

  const aprobar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comisiones")
        .update({ estado: "Aprobada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comisión aprobada");
      qc.invalidateQueries({ queryKey: ["comisiones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarComision = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comisiones")
        .update({ estado: "Cancelada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comisión cancelada");
      qc.invalidateQueries({ queryKey: ["comisiones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const crearLiquidacion = useMutation({
    mutationFn: async (comercialId: string) => {
      const { error } = await supabase.rpc("crear_liquidacion", { p_user_id: comercialId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidación creada");
      qc.invalidateQueries({ queryKey: ["comisiones"] });
      qc.invalidateQueries({ queryKey: ["liquidaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmarPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("liquidaciones")
        .update({ estado: "Pagada", pagada_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago confirmado");
      qc.invalidateQueries({ queryKey: ["liquidaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const misComisiones = useMemo(
    () => comisiones.filter((c) => c.user_id === userId),
    [comisiones, userId],
  );
  const misLiquidaciones = useMemo(
    () => liquidaciones.filter((l) => l.user_id === userId),
    [liquidaciones, userId],
  );

  const totales = useMemo(() => {
    const base = esAdmin ? comisiones : misComisiones;
    return {
      pendiente: base
        .filter((c) => c.estado === "Pendiente")
        .reduce((s, c) => s + Number(c.importe), 0),
      aprobada: base
        .filter((c) => c.estado === "Aprobada")
        .reduce((s, c) => s + Number(c.importe), 0),
      liquidada: base
        .filter((c) => c.estado === "Liquidada")
        .reduce((s, c) => s + Number(c.importe), 0),
    };
  }, [comisiones, misComisiones, esAdmin]);

  const pendientesAdmin = useMemo(
    () => comisiones.filter((c) => c.estado === "Pendiente"),
    [comisiones],
  );

  const aprobadasPorComercial = useMemo(() => {
    const grupos = new Map<string, { comisiones: Comision[]; total: number }>();
    for (const c of comisiones) {
      if (c.estado !== "Aprobada") continue;
      const grupo = grupos.get(c.user_id) ?? { comisiones: [], total: 0 };
      grupo.comisiones.push(c);
      grupo.total += Number(c.importe);
      grupos.set(c.user_id, grupo);
    }
    return Array.from(grupos.entries()).sort((a, b) =>
      (comerciales[a[0]] ?? "").localeCompare(comerciales[b[0]] ?? ""),
    );
  }, [comisiones, comerciales]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <ResumenCard label="Pendiente de aprobar" valor={totales.pendiente} tono="text-amber" />
        <ResumenCard label="Aprobada, sin liquidar" valor={totales.aprobada} tono="text-brand" />
        <ResumenCard label="Liquidada" valor={totales.liquidada} tono="text-lime" />
      </div>

      {esAdmin && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold text-ink-100">Comisiones pendientes de aprobar</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                  <th className="pb-2 pr-3 font-medium">Comercial</th>
                  <th className="pb-2 pr-3 font-medium">Concepto</th>
                  <th className="pb-2 pr-3 font-medium">%</th>
                  <th className="pb-2 pr-3 text-right font-medium">Importe</th>
                  <th className="pb-2 pl-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pendientesAdmin.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3 text-ink-200">{comerciales[c.user_id] ?? "—"}</td>
                    <td className="py-3 pr-3 text-ink-200">{c.concepto}</td>
                    <td className="py-3 pr-3 font-mono text-ink-500">{c.porcentaje}%</td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-ink-100">
                      {eur.format(Number(c.importe))}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => aprobar.mutate(c.id)}
                        className="mr-3 font-mono text-[10px] uppercase tracking-widest text-brand hover:underline"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => cancelarComision.mutate(c.id)}
                        className="font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
                {pendientesAdmin.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-ink-500">
                      No hay comisiones pendientes de aprobar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {esAdmin && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold text-ink-100">Aprobadas por comercial</h2>
          <p className="text-xs text-ink-500">
            Agrupa las comisiones aprobadas y sin liquidar de cada comercial en una liquidación.
          </p>
          <div className="mt-4 space-y-3">
            {aprobadasPorComercial.map(([comercialId, grupo]) => (
              <div
                key={comercialId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ink-100">{comerciales[comercialId] ?? "—"}</p>
                  <p className="font-mono text-[11px] text-ink-500">
                    {grupo.comisiones.length} comisión{grupo.comisiones.length === 1 ? "" : "es"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-ink-100">
                    {eur.format(grupo.total)}
                  </span>
                  <button
                    onClick={() => crearLiquidacion.mutate(comercialId)}
                    disabled={crearLiquidacion.isPending}
                    className="rounded-lg bg-brand px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
                  >
                    Crear liquidación
                  </button>
                </div>
              </div>
            ))}
            {aprobadasPorComercial.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-500">
                No hay comisiones aprobadas pendientes de liquidar.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">
          {esAdmin ? "Liquidaciones" : "Mis liquidaciones"}
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                {esAdmin && <th className="pb-2 pr-3 font-medium">Comercial</th>}
                <th className="pb-2 pr-3 font-medium">Fecha</th>
                <th className="pb-2 pr-3 text-right font-medium">Importe</th>
                <th className="pb-2 pr-3 font-medium">Estado</th>
                {esAdmin && <th className="pb-2 pl-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(esAdmin ? liquidaciones : misLiquidaciones).map((l) => (
                <tr key={l.id}>
                  {esAdmin && (
                    <td className="py-3 pr-3 text-ink-200">{comerciales[l.user_id] ?? "—"}</td>
                  )}
                  <td className="py-3 pr-3 font-mono text-[11px] text-ink-500">
                    {formatFecha(l.created_at)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-semibold text-ink-100">
                    {eur.format(Number(l.importe_total))}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${estadoLiquidacionClass[l.estado]}`}
                    >
                      {l.estado}
                    </span>
                  </td>
                  {esAdmin && (
                    <td className="py-3 pl-3 text-right">
                      {l.estado === "Pendiente" && (
                        <button
                          onClick={() => confirmarPago.mutate(l.id)}
                          className="font-mono text-[10px] uppercase tracking-widest text-brand hover:underline"
                        >
                          Confirmar pago
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {(esAdmin ? liquidaciones : misLiquidaciones).length === 0 && (
                <tr>
                  <td colSpan={esAdmin ? 5 : 3} className="py-8 text-center text-sm text-ink-500">
                    Todavía no hay liquidaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!esAdmin && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold text-ink-100">Mis comisiones</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                  <th className="pb-2 pr-3 font-medium">Concepto</th>
                  <th className="pb-2 pr-3 font-medium">Fecha</th>
                  <th className="pb-2 pr-3 text-right font-medium">Importe</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {misComisiones.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3 text-ink-200">{c.concepto}</td>
                    <td className="py-3 pr-3 font-mono text-[11px] text-ink-500">
                      {formatFecha(c.created_at)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold text-ink-100">
                      {eur.format(Number(c.importe))}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${estadoComisionClass[c.estado]}`}
                      >
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
                {misComisiones.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-ink-500">
                      Todavía no tienes comisiones generadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ResumenCard({ label, valor, tono }: { label: string; valor: number; tono: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tono}`}>{eur.format(valor)}</p>
    </div>
  );
}
