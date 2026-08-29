import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL, eur } from "@/lib/intranet";

export type Perfil = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  objetivo_trimestral: number;
};

export function PerfilTab({ perfil, rol }: { perfil: Perfil; rol: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(perfil.nombre);
  const [telefono, setTelefono] = useState(perfil.telefono);
  const [objetivo, setObjetivo] = useState(String(perfil.objetivo_trimestral));

  const iniciales = perfil.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  const guardar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("perfiles")
        .update({
          nombre,
          telefono,
          objetivo_trimestral: Number(objetivo.replace(",", ".")) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", perfil.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["perfil"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel p-5">
        <div className="grid size-16 place-items-center rounded-full bg-brand/15 font-mono text-xl font-semibold text-brand outline-1 -outline-offset-1 outline-brand/30">
          {iniciales || "?"}
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink-100">{perfil.nombre}</h2>
          <p className="text-sm text-ink-500">{perfil.email}</p>
          <span className="mt-1 inline-block rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
            {rol === "admin" ? "Administrador" : "Comercial"}
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink-100">Datos del comercial</h2>
          <p className="text-xs text-ink-500">
            Tu nombre y teléfono se muestran de forma permanente en la cabecera del portal.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              guardar.mutate();
            }}
          >
            <Campo label="Nombre y apellidos">
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
            <Campo label="Teléfono corporativo">
              <input
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
            <Campo label="Email">
              <input
                readOnly
                value={perfil.email}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-400 outline-none"
              />
            </Campo>
            <Campo label="Objetivo trimestral €">
              <input
                inputMode="decimal"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={guardar.isPending}
                className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
              >
                {guardar.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>

          <div className="mt-5 border-t border-line pt-5">
            <CambiarContrasenaForm />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 lg:row-span-2">
          <h2 className="text-lg font-semibold text-ink-100">Soporte</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Fila termino="Nombre" valor={perfil.nombre} />
            <Fila termino="Teléfono" valor={perfil.telefono || "—"} mono />
            <Fila termino="Rol" valor={rol === "admin" ? "Administrador" : "Comercial"} />
            <Fila termino="Administración" valor={ADMIN_EMAIL} />
            <Fila termino="Objetivo" valor={eur.format(Number(perfil.objetivo_trimestral))} mono />
          </dl>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Incidencia intranet Labs24k")}`}
            className="mt-5 block w-full rounded-xl bg-accent/15 py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-widest text-accent glow-violet"
          >
            Reportar incidencia
          </a>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="mt-3 block w-full rounded-xl border border-line py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-widest text-coral transition hover:border-coral"
          >
            Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  );
}

function CambiarContrasenaForm() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const cambiar = useMutation({
    mutationFn: async () => {
      if (nueva.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres");
      if (nueva !== confirmar) throw new Error("Las contraseñas no coinciden");

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw userError ?? new Error("Sesión no disponible");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: actual,
      });
      if (reauthError) throw new Error("La contraseña actual no es correcta");

      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada");
      setActual("");
      setNueva("");
      setConfirmar("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        cambiar.mutate();
      }}
    >
      <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-400 sm:col-span-3">
        Cambiar contraseña
      </h3>
      <Campo label="Contraseña actual">
        <input
          required
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
        />
      </Campo>
      <Campo label="Nueva contraseña">
        <input
          required
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
        />
      </Campo>
      <Campo label="Confirmar nueva">
        <input
          required
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none focus:border-brand"
        />
      </Campo>
      <div className="sm:col-span-3">
        <p className="mb-2 text-[11px] text-ink-500">Mínimo 8 caracteres.</p>
        <button
          type="submit"
          disabled={cambiar.isPending}
          className="w-full rounded-xl border border-line py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-ink-200 transition hover:border-brand disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {cambiar.isPending ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </div>
    </form>
  );
}

function Fila({ termino, valor, mono }: { termino: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-ink-500">{termino}</dt>
      <dd className={mono ? "font-mono text-brand" : "font-medium text-ink-100"}>{valor}</dd>
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
