import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estadoCitaClass, formatFecha, formatHora, type EstadoCita } from "@/lib/intranet";

export type Cita = {
  id: string;
  cliente: string;
  fecha_cita: string;
  ubicacion: string | null;
  notas: string | null;
  resultado: string | null;
  estado: EstadoCita;
};

const ESTADOS: EstadoCita[] = ["Pendiente", "Realizada", "Cerrada", "Cancelada"];

export function AgendaTab({ citas, userId }: { citas: Cita[]; userId: string }) {
  const qc = useQueryClient();
  const [cliente, setCliente] = useState("");
  const [fechaCita, setFechaCita] = useState(() => new Date().toISOString().slice(0, 16));
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("citas").insert({
        user_id: userId,
        cliente,
        fecha_cita: new Date(fechaCita).toISOString(),
        ubicacion,
        notas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cita registrada");
      setCliente("");
      setUbicacion("");
      setNotas("");
      qc.invalidateQueries({ queryKey: ["citas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async (payload: { id: string; estado?: EstadoCita; resultado?: string }) => {
      const { id, ...cambios } = payload;
      const { error } = await supabase.from("citas").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const porDia = citas.reduce<Record<string, Cita[]>>((acc, c) => {
    const clave = c.fecha_cita.slice(0, 10);
    (acc[clave] ||= []).push(c);
    return acc;
  }, {});
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">Nueva cita</h2>
        <p className="text-xs text-ink-500">Registra la visita y su seguimiento.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
        >
          <Campo label="Cliente">
            <input
              required
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Clínica Vega"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <Campo label="Fecha y hora">
            <input
              required
              type="datetime-local"
              value={fechaCita}
              onChange={(e) => setFechaCita(e.target.value)}
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
            />
          </Campo>
          <Campo label="Ubicación">
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Oficina cliente"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <Campo label="Notas de seguimiento">
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Objetivo de la reunión, material a preparar…"
              className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <button
            type="submit"
            disabled={crear.isPending}
            className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
          >
            {crear.isPending ? "Guardando…" : "Agendar cita"}
          </button>
        </form>
      </section>

      <section className="space-y-5 lg:col-span-2">
        {dias.map((dia) => (
          <div key={dia} className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-mono text-xs uppercase tracking-widest text-ink-400">
              {formatFecha(dia)}
            </h3>
            <div className="mt-4 space-y-3">
              {(porDia[dia] ?? [])
                .sort((a, b) => a.fecha_cita.localeCompare(b.fecha_cita))
                .map((c) => (
                  <div key={c.id} className="rounded-xl border border-line bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-brand">
                        {formatHora(c.fecha_cita)}
                      </span>
                      <select
                        value={c.estado}
                        onChange={(e) =>
                          actualizar.mutate({ id: c.id, estado: e.target.value as EstadoCita })
                        }
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest outline-none ${estadoCitaClass[c.estado]}`}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e} className="bg-card text-ink-100">
                            {e}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink-100">{c.cliente}</p>
                    {c.ubicacion && <p className="text-[11px] text-ink-500">{c.ubicacion}</p>}
                    {c.notas && <p className="mt-2 text-xs text-ink-400">{c.notas}</p>}
                    <textarea
                      rows={2}
                      defaultValue={c.resultado ?? ""}
                      placeholder="Resultado de la reunión…"
                      onBlur={(e) => {
                        if (e.target.value !== (c.resultado ?? "")) {
                          actualizar.mutate({ id: c.id, resultado: e.target.value });
                        }
                      }}
                      className="mt-3 w-full resize-none rounded-lg border border-line bg-panel px-3 py-2 text-xs text-ink-200 outline-none placeholder:text-ink-500 focus:border-brand"
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
        {dias.length === 0 && (
          <div className="rounded-2xl border border-line bg-panel p-10 text-center text-sm text-ink-500">
            No hay citas registradas todavía.
          </div>
        )}
      </section>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}
