import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { estadoCitaClass, formatHora, mayusInicial, type EstadoCita } from "@/lib/intranet";

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
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function clave(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function AgendaTab({ citas, userId }: { citas: Cita[]; userId: string }) {
  const qc = useQueryClient();
  const [cliente, setCliente] = useState("");
  const [hora, setHora] = useState("10:00");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [mesVisible, setMesVisible] = useState(() => startOfMonth(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => new Date());

  const citasPorDia = citas.reduce<Record<string, Cita[]>>((acc, c) => {
    const k = c.fecha_cita.slice(0, 10);
    (acc[k] ||= []).push(c);
    return acc;
  }, {});

  const crear = useMutation({
    mutationFn: async () => {
      const [h, m] = hora.split(":").map(Number);
      const fecha = new Date(diaSeleccionado);
      fecha.setHours(h || 0, m || 0, 0, 0);
      const { error } = await supabase.from("citas").insert({
        user_id: userId,
        cliente,
        fecha_cita: fecha.toISOString(),
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

  const inicioCalendario = startOfWeek(startOfMonth(mesVisible), { weekStartsOn: 1 });
  const finCalendario = endOfWeek(endOfMonth(mesVisible), { weekStartsOn: 1 });
  const dias = eachDayOfInterval({ start: inicioCalendario, end: finCalendario });

  function seleccionarDia(d: Date) {
    if (!isSameMonth(d, mesVisible)) setMesVisible(startOfMonth(d));
    setDiaSeleccionado(d);
  }

  const citasDelDia = (citasPorDia[clave(diaSeleccionado)] ?? []).sort((a, b) =>
    a.fecha_cita.localeCompare(b.fecha_cita),
  );

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">Nueva cita</h2>
        <p className="text-xs text-ink-500">
          Para el{" "}
          <span className="font-medium text-brand">
            {mayusInicial(format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es }))}
          </span>
          . Elige otro día en el calendario si hace falta.
        </p>
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
          <Campo label="Hora">
            <input
              required
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
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

      <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-100">
            {mayusInicial(format(mesVisible, "MMMM yyyy", { locale: es }))}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMesVisible((m) => subMonths(m, 1))}
              aria-label="Mes anterior"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-400 transition hover:border-brand hover:text-brand"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setMesVisible(startOfMonth(new Date()));
                setDiaSeleccionado(new Date());
              }}
              className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-400 transition hover:border-brand hover:text-brand"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setMesVisible((m) => addMonths(m, 1))}
              aria-label="Mes siguiente"
              className="grid size-8 place-items-center rounded-lg border border-line text-ink-400 transition hover:border-brand hover:text-brand"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="pb-1 text-center font-mono text-[10px] uppercase tracking-widest text-ink-500"
            >
              {d}
            </div>
          ))}
          {dias.map((d) => {
            const enMes = isSameMonth(d, mesVisible);
            const seleccionado = isSameDay(d, diaSeleccionado);
            const hoy = isToday(d);
            const numCitas = (citasPorDia[clave(d)] ?? []).length;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => seleccionarDia(d)}
                className={`relative aspect-square rounded-xl border text-sm transition ${
                  seleccionado
                    ? "border-brand bg-brand text-primary-foreground"
                    : hoy
                      ? "border-brand text-brand"
                      : "border-line text-ink-200 hover:border-brand/50"
                } ${enMes ? "" : "opacity-35"}`}
              >
                {d.getDate()}
                {numCitas > 0 && (
                  <span
                    className={`absolute bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${
                      seleccionado ? "bg-primary-foreground" : "bg-brand"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold text-ink-100">
          {mayusInicial(format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es }))}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {citasDelDia.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-brand">{formatHora(c.fecha_cita)}</span>
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
          {citasDelDia.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500 sm:col-span-2 lg:col-span-3">
              No hay citas para este día.
            </p>
          )}
        </div>
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
