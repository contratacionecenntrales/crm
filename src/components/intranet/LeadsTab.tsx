import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estadoLeadClass, formatFecha, type EstadoLead } from "@/lib/intranet";

export type Lead = {
  id: string;
  empresa: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  sector: string | null;
  campana: string | null;
  notas: string | null;
  estado: EstadoLead;
  asignado_a: string | null;
  creado_por: string;
  created_at: string;
};

const ESTADOS: EstadoLead[] = ["Nuevo", "Contactado", "Cita agendada", "Ganado", "Descartado"];

export function LeadsTab({
  leads,
  userId,
  esAdmin,
  comerciales,
}: {
  leads: Lead[];
  userId: string;
  esAdmin: boolean;
  comerciales: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [sector, setSector] = useState("");
  const [campana, setCampana] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | "Todos">("Todos");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({
        empresa,
        contacto: contacto || null,
        telefono: telefono || null,
        email: email || null,
        ciudad: ciudad || null,
        sector: sector || null,
        campana: campana || null,
        creado_por: userId,
        asignado_a: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead creado");
      setEmpresa("");
      setContacto("");
      setTelefono("");
      setEmail("");
      setCiudad("");
      setSector("");
      setCampana("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async (payload: {
      id: string;
      estado?: EstadoLead;
      asignado_a?: string | null;
      notas?: string;
    }) => {
      const { id, ...cambios } = payload;
      const { error } = await supabase.from("leads").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead eliminado");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leadsFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return leads.filter((l) => {
      if (filtroEstado !== "Todos" && l.estado !== filtroEstado) return false;
      if (!termino) return true;
      return [l.empresa, l.contacto, l.ciudad, l.sector, l.campana]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(termino));
    });
  }, [leads, busqueda, filtroEstado]);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">Nuevo lead</h2>
        <p className="text-xs text-ink-500">Se asigna automáticamente a ti.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
        >
          <Campo label="Empresa">
            <input
              required
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="SolarTech"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <Campo label="Contacto">
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Nombre y apellidos"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Teléfono">
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
            <Campo label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ciudad">
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
            <Campo label="Sector">
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
          </div>
          <Campo label="Campaña">
            <input
              value={campana}
              onChange={(e) => setCampana(e.target.value)}
              placeholder="Origen del lead"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <button
            type="submit"
            disabled={crear.isPending}
            className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
          >
            {crear.isPending ? "Creando…" : "Crear lead"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-100">
            {esAdmin ? "Todos los leads" : "Mis leads"}
          </h2>
          <span className="font-mono text-[11px] text-ink-500">
            {leadsFiltrados.length} de {leads.length}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empresa, contacto, ciudad, sector…"
            className="min-w-[220px] flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoLead | "Todos")}
            className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand"
          >
            <option value="Todos">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                <th className="pb-2 pr-3 font-medium">Empresa</th>
                <th className="pb-2 pr-3 font-medium">Ciudad / Sector</th>
                <th className="pb-2 pr-3 font-medium">Campaña</th>
                <th className="pb-2 pr-3 font-medium">Fecha</th>
                {esAdmin && <th className="pb-2 pr-3 font-medium">Asignado</th>}
                <th className="pb-2 font-medium">Estado</th>
                {esAdmin && <th className="pb-2 pl-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leadsFiltrados.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-ink-100">{l.empresa}</p>
                    {l.contacto && <p className="text-[11px] text-ink-500">{l.contacto}</p>}
                  </td>
                  <td className="py-3 pr-3 text-ink-200">
                    {[l.ciudad, l.sector].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-3 pr-3 text-ink-200">{l.campana || "—"}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-ink-500">
                    {formatFecha(l.created_at)}
                  </td>
                  {esAdmin && (
                    <td className="py-3 pr-3">
                      <select
                        value={l.asignado_a ?? ""}
                        onChange={(e) =>
                          actualizar.mutate({ id: l.id, asignado_a: e.target.value || null })
                        }
                        className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-100 outline-none focus:border-brand"
                      >
                        <option value="">Sin asignar</option>
                        {Object.entries(comerciales).map(([id, nombre]) => (
                          <option key={id} value={id}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="py-3">
                    <select
                      value={l.estado}
                      onChange={(e) =>
                        actualizar.mutate({ id: l.id, estado: e.target.value as EstadoLead })
                      }
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest outline-none ${estadoLeadClass[l.estado]}`}
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e} className="bg-card text-ink-100">
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                  {esAdmin && (
                    <td className="py-3 pl-3 text-right">
                      <button
                        onClick={() => eliminar.mutate(l.id)}
                        className="font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
                      >
                        Borrar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {leadsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={esAdmin ? 7 : 5} className="py-8 text-center text-sm text-ink-500">
                    {leads.length === 0
                      ? "Todavía no tienes leads."
                      : "Ningún lead coincide con la búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
