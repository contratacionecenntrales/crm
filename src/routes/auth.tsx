import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso comerciales | Intranet Labs24k" },
      {
        name: "description",
        content:
          "Área privada de Labs24k. Accede con tu cuenta corporativa para gestionar facturación, citas y recursos comerciales.",
      },
      { property: "og:title", content: "Acceso comerciales | Intranet Labs24k" },
      {
        property: "og:description",
        content: "Área privada de Labs24k para el equipo comercial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nombre, telefono },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ya puedes acceder.");
        setModo("login");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la operación");
    } finally {
      setEnviando(false);
    }
  }

  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión con Google");
    }
    // On success Supabase redirects the browser to Google; there is nothing
    // to navigate to here.
  }

  return (
    <div className="grid min-h-screen place-items-center bg-void bg-grid px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-brand glow-gold">
            <span className="font-mono text-sm font-bold text-primary-foreground">24</span>
          </div>
          <div className="leading-tight">
            <p className="font-mono text-xs font-semibold tracking-[0.22em] text-brand text-glow-gold">
              LABS24K
            </p>
            <p className="text-[11px] text-ink-400">Portal de Gestión Comercial</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-2xl font-bold text-ink-100">
            {modo === "login" ? "Acceso al portal" : "Alta de comercial"}
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            {modo === "login"
              ? "Introduce tus credenciales corporativas."
              : "Registra tu nombre y teléfono corporativo."}
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            {modo === "registro" && (
              <>
                <Field label="Nombre y apellidos">
                  <input
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
                    placeholder="Marta Iglesias"
                  />
                </Field>
                <Field label="Teléfono corporativo">
                  <input
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
                    placeholder="+34 611 22 44 88"
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
                placeholder="nombre@labs24k.com"
              />
            </Field>
            <Field label="Contraseña">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
                placeholder="••••••••"
              />
            </Field>

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-gold disabled:opacity-60"
            >
              {enviando ? "Procesando…" : modo === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <button
            onClick={onGoogle}
            className="mt-3 w-full rounded-xl border border-line bg-card py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-ink-200 transition hover:border-brand"
          >
            Continuar con Google
          </button>

          <button
            onClick={() => setModo(modo === "login" ? "registro" : "login")}
            className="mt-4 w-full text-center text-xs text-ink-400 transition hover:text-brand"
          >
            {modo === "login" ? "¿Nuevo comercial? Crear cuenta" : "Ya tengo cuenta · Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}
