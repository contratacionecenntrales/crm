import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  eur,
  estadoTicketClass,
  formatFecha,
  prioridadTicketClass,
  type EstadoLead,
  type EstadoTicket,
  type PrioridadTicket,
} from "@/lib/intranet";
import type { Lead } from "./LeadsTab";

export type Ticket = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  creado_por: string;
  asignado_a: string | null;
  created_at: string;
};

export type Campana = {
  id: string;
  nombre: string;
  presupuesto: number | null;
  activa: boolean;
};

const ESTADOS_LEAD: EstadoLead[] = ["Nuevo", "Contactado", "Cita agendada", "Ganado", "Descartado"];
const ESTADOS_TICKET: EstadoTicket[] = ["Abierto", "En proceso", "Resuelto", "Cerrado"];
const PRIORIDADES: PrioridadTicket[] = ["Baja", "Media", "Alta"];

export function BackofficeTab({
  leads,
  tickets,
  campanas,
  userId,
  puedeGestionarTickets,
  comerciales,
}: {
  leads: Lead[];
  tickets: Ticket[];
  campanas: Campana[];
  userId: string;
  puedeGestionarTickets: boolean;
  comerciales: Record<string, string>;
}) {
  const leadsPorEstado = useMemo(
    () =>
      ESTADOS_LEAD.map((estado) => ({
        estado,
        total: leads.filter((l) => l.estado === estado).length,
      })),
    [leads],
  );
  const ticketsPorEstado = useMemo(
    () =>
      ESTADOS_TICKET.map((estado) => ({
        estado,
        total: tickets.filter((t) => t.estado === estado).length,
      })),
    [tickets],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-100">Métricas en tiempo real</h2>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-lime">
            <span className="size-1.5 rounded-full bg-lime" /> En vivo
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-400">
              Leads
            </p>
            <div className="flex flex-wrap gap-2">
              {leadsPorEstado.map(({ estado, total }) => (
                <span
                  key={estado}
                  className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-ink-200"
                >
                  {estado}: <span className="font-mono font-semibold text-ink-100">{total}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-400">
              Tickets
            </p>
            <div className="flex flex-wrap gap-2">
              {ticketsPorEstado.map(({ estado, total }) => (
                <span
                  key={estado}
                  className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-ink-200"
                >
                  {estado}: <span className="font-mono font-semibold text-ink-100">{total}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <TicketsPanel
          tickets={tickets}
          userId={userId}
          puedeGestionar={puedeGestionarTickets}
          comerciales={comerciales}
        />
        <CampanasPanel campanas={campanas} leads={leads} />
      </div>
    </div>
  );
}

function TicketsPanel({
  tickets,
  userId,
  puedeGestionar,
  comerciales,
}: {
  tickets: Ticket[];
  userId: string;
  puedeGestionar: boolean;
  comerciales: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadTicket>("Media");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tickets").insert({
        titulo,
        descripcion: descripcion || null,
        prioridad,
        creado_por: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket abierto");
      setTitulo("");
      setDescripcion("");
      setPrioridad("Media");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async (payload: {
      id: string;
      estado?: EstadoTicket;
      asignado_a?: string | null;
    }) => {
      const { id, ...cambios } = payload;
      const { error } = await supabase.from("tickets").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Tickets internos</h2>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título del ticket"
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <div className="flex gap-2">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción breve"
            className="flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
            className="rounded-xl border border-line bg-card px-2 py-2 text-sm text-ink-100 outline-none focus:border-brand"
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={crear.isPending}
          className="rounded-xl bg-brand px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {crear.isPending ? "Abriendo…" : "Abrir ticket"}
        </button>
      </form>

      <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{t.titulo}</p>
                {t.descripcion && (
                  <p className="truncate text-[11px] text-ink-500">{t.descripcion}</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-ink-500">
                  {comerciales[t.creado_por] ?? "—"} · {formatFecha(t.created_at)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${prioridadTicketClass[t.prioridad]}`}
              >
                {t.prioridad}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {puedeGestionar ? (
                <>
                  <select
                    value={t.estado}
                    onChange={(e) =>
                      actualizar.mutate({ id: t.id, estado: e.target.value as EstadoTicket })
                    }
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest outline-none ${estadoTicketClass[t.estado]}`}
                  >
                    {ESTADOS_TICKET.map((e) => (
                      <option key={e} value={e} className="bg-card text-ink-100">
                        {e}
                      </option>
                    ))}
                  </select>
                  <select
                    value={t.asignado_a ?? ""}
                    onChange={(e) =>
                      actualizar.mutate({ id: t.id, asignado_a: e.target.value || null })
                    }
                    className="rounded-md border border-line bg-panel px-2 py-1 text-[10px] text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="">Sin asignar</option>
                    {Object.entries(comerciales).map(([id, nombre]) => (
                      <option key={id} value={id}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <span
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${estadoTicketClass[t.estado]}`}
                >
                  {t.estado}
                </span>
              )}
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-500">Sin tickets.</p>
        )}
      </div>
    </section>
  );
}

function CampanasPanel({ campanas, leads }: { campanas: Campana[]; leads: Lead[] }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [presupuesto, setPresupuesto] = useState("");

  const leadsPorCampana = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of leads) {
      if (!l.campana) continue;
      mapa.set(l.campana, (mapa.get(l.campana) ?? 0) + 1);
    }
    return mapa;
  }, [leads]);

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campanas").insert({
        nombre,
        presupuesto: presupuesto ? Number(presupuesto.replace(",", ".")) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaña creada");
      setNombre("");
      setPresupuesto("");
      qc.invalidateQueries({ queryKey: ["campanas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiva = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase.from("campanas").update({ activa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campanas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campanas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaña eliminada");
      qc.invalidateQueries({ queryKey: ["campanas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Campañas</h2>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de campaña"
          className="min-w-[160px] flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          inputMode="decimal"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
          placeholder="Presupuesto €"
          className="w-32 rounded-xl border border-line bg-card px-3 py-2 font-mono text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <button
          type="submit"
          disabled={crear.isPending}
          className="rounded-xl bg-brand px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {crear.isPending ? "Creando…" : "Crear"}
        </button>
      </form>

      <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {campanas.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{c.nombre}</p>
              <p className="font-mono text-[11px] text-ink-500">
                {leadsPorCampana.get(c.nombre) ?? 0} leads
                {c.presupuesto != null ? ` · ${eur.format(Number(c.presupuesto))}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => toggleActiva.mutate({ id: c.id, activa: !c.activa })}
                className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
                  c.activa ? "bg-lime/15 text-lime" : "bg-secondary text-ink-400"
                }`}
              >
                {c.activa ? "Activa" : "Pausada"}
              </button>
              <button
                onClick={() => eliminar.mutate(c.id)}
                className="font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
        {campanas.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-500">Sin campañas.</p>
        )}
      </div>
    </section>
  );
}
