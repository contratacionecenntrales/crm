import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FASES_CANDIDATO,
  faseCandidatoClass,
  formatFecha,
  type FaseCandidato,
} from "@/lib/intranet";

export type Candidato = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puesto: string;
  fase: FaseCandidato;
  notas: string | null;
  entrevistador_id: string | null;
  creado_por: string;
  created_at: string;
};

export function EntrevistasTab({
  candidatos,
  userId,
  comerciales,
}: {
  candidatos: Candidato[];
  userId: string;
  comerciales: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidatos").insert({
        nombre,
        puesto,
        email: email || null,
        telefono: telefono || null,
        entrevistador_id: userId,
        creado_por: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidato añadido");
      setNombre("");
      setPuesto("");
      setEmail("");
      setTelefono("");
      qc.invalidateQueries({ queryKey: ["candidatos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async (payload: {
      id: string;
      fase?: FaseCandidato;
      entrevistador_id?: string | null;
    }) => {
      const { id, ...cambios } = payload;
      const { error } = await supabase.from("candidatos").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidatos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidatos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidato eliminado");
      qc.invalidateQueries({ queryKey: ["candidatos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columnas = useMemo(() => {
    return FASES_CANDIDATO.map((fase) => ({
      fase,
      candidatos: candidatos
        .filter((c) => c.fase === fase)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
  }, [candidatos]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">Nuevo candidato</h2>
        <p className="text-xs text-ink-500">Entra en la fase "Recibido" y se te asigna a ti.</p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
        >
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellidos"
            className="min-w-[180px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <input
            required
            value={puesto}
            onChange={(e) => setPuesto(e.target.value)}
            placeholder="Puesto"
            className="min-w-[160px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="min-w-[160px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono"
            className="min-w-[140px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
          <button
            type="submit"
            disabled={crear.isPending}
            className="rounded-xl bg-brand px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
          >
            {crear.isPending ? "Creando…" : "Añadir candidato"}
          </button>
        </form>
      </section>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-4 pb-2">
          {columnas.map(({ fase, candidatos: enFase }) => (
            <div key={fase} className="w-72 shrink-0 rounded-2xl border border-line bg-panel p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ${faseCandidatoClass[fase]}`}
                >
                  {fase}
                </span>
                <span className="font-mono text-[10px] text-ink-500">{enFase.length}</span>
              </div>
              <div className="space-y-2">
                {enFase.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line bg-card p-3">
                    <p className="text-sm font-medium text-ink-100">{c.nombre}</p>
                    <p className="text-[11px] text-ink-400">{c.puesto}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink-500">
                      {comerciales[c.entrevistador_id ?? ""] ?? "Sin asignar"} ·{" "}
                      {formatFecha(c.created_at)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={c.fase}
                        onChange={(e) =>
                          actualizar.mutate({ id: c.id, fase: e.target.value as FaseCandidato })
                        }
                        className="flex-1 rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-ink-100 outline-none focus:border-brand"
                      >
                        {FASES_CANDIDATO.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => eliminar.mutate(c.id)}
                        className="font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
                {enFase.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-ink-500">Vacío</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
