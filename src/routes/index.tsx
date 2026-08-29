import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardTab } from "@/components/intranet/DashboardTab";
import { FacturacionTab, type Factura } from "@/components/intranet/FacturacionTab";
import { AgendaTab, type Cita } from "@/components/intranet/AgendaTab";
import { RecursosTab, type Recurso } from "@/components/intranet/RecursosTab";
import { PerfilTab, type Perfil } from "@/components/intranet/PerfilTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intranet comercial Labs24k | Facturación, agenda y recursos" },
      {
        name: "description",
        content:
          "Portal privado del equipo comercial de Labs24k: registro de facturación, agenda de citas, descarga de PDFs corporativos y soporte directo con administración.",
      },
      { property: "og:title", content: "Intranet comercial Labs24k" },
      {
        property: "og:description",
        content:
          "Gestiona facturación, citas y recursos comerciales desde un único portal corporativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Intranet,
});

const TABS = ["Dashboard", "Facturación", "Recursos", "Agenda", "Perfil"] as const;
type Tab = (typeof TABS)[number];

function Intranet() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("Dashboard");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const uid = user?.id;

  const perfilQ = useQuery({
    queryKey: ["perfil", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfiles")
        .select("id, nombre, telefono, email, objetivo_trimestral")
        .eq("id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data as Perfil | null;
    },
  });

  const rolQ = useQuery({
    queryKey: ["rol", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid!);
      if (error) throw error;
      return data?.some((r) => r.role === "admin") ? "admin" : "comercial";
    },
  });

  const facturasQ = useQuery({
    queryKey: ["facturacion", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturacion")
        .select("id, user_id, concepto, cliente, importe, fecha, comprobante, estado")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Factura[];
    },
  });

  const citasQ = useQuery({
    queryKey: ["citas", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("citas")
        .select("id, cliente, fecha_cita, ubicacion, notas, resultado, estado")
        .order("fecha_cita", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cita[];
    },
  });

  const comercialesQ = useQuery({
    queryKey: ["comerciales", uid],
    enabled: !!uid && rolQ.data === "admin",
    queryFn: async () => {
      const { data, error } = await supabase.from("perfiles").select("id, nombre");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.nombre])) as Record<
        string,
        string
      >;
    },
  });

  const recursosQ = useQuery({
    queryKey: ["recursos"],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recursos")
        .select("id, titulo, descripcion, categoria, archivo_url, tamano")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Recurso[];
    },
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-void bg-grid">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-500">Cargando portal…</p>
      </div>
    );
  }

  const perfil: Perfil = perfilQ.data ?? {
    id: user.id,
    nombre: user.email?.split("@")[0] ?? "Comercial",
    telefono: "",
    email: user.email ?? "",
    objetivo_trimestral: 55000,
  };
  const rol = rolQ.data ?? "comercial";
  const facturas = facturasQ.data ?? [];
  const citas = citasQ.data ?? [];
  const iniciales = perfil.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-void bg-grid text-ink-200">
      <header className="sticky top-0 z-30 border-b border-line bg-panel/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
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

          <div className="hidden items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2 sm:flex">
            <div className="grid size-10 place-items-center rounded-full bg-panel font-mono text-xs font-semibold text-brand outline-1 -outline-offset-1 outline-brand/30">
              {iniciales || "L"}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-100">{perfil.nombre}</p>
              <p className="font-mono text-[11px] text-brand">
                {perfil.telefono || "Sin teléfono"}
              </p>
            </div>
            <span className="ml-1 rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
              {rol === "admin" ? "Admin" : "Comercial"}
            </span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="ml-1 font-mono text-[10px] uppercase tracking-widest text-ink-500 transition hover:text-coral"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2 sm:hidden">
          <div className="flex items-center gap-2 leading-tight">
            <span className="grid size-7 place-items-center rounded-full bg-panel font-mono text-[10px] font-semibold text-brand outline-1 -outline-offset-1 outline-brand/30">
              {iniciales || "L"}
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-100">{perfil.nombre}</p>
              <p className="font-mono text-[10px] text-brand">
                {perfil.telefono || "Sin teléfono"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="font-mono text-[10px] uppercase tracking-widest text-ink-500 transition hover:text-coral"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink-500">{tab}</p>
            <h1 className="mt-1 text-3xl font-bold text-ink-100 sm:text-4xl">
              Hola, <span className="text-brand text-glow-gold">{perfil.nombre.split(" ")[0]}</span>
              . Tu mes va por buen camino.
            </h1>
          </div>
          <div className="font-mono text-xs text-ink-400">
            <span className="text-lime">●</span> En línea &nbsp;·&nbsp;{" "}
            {new Date().toLocaleDateString("es-ES")}
          </div>
        </div>

        <nav className="mt-8 flex flex-wrap gap-2 border-b border-line pb-px">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                t === tab
                  ? "rounded-lg bg-brand/15 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-brand text-glow-gold glow-gold"
                  : "rounded-lg px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-ink-400 transition hover:text-ink-200"
              }
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "Dashboard" && (
            <DashboardTab
              facturas={facturas}
              citas={citas}
              objetivo={Number(perfil.objetivo_trimestral)}
            />
          )}
          {tab === "Facturación" && (
            <FacturacionTab
              facturas={facturas}
              userId={user.id}
              esAdmin={rol === "admin"}
              comerciales={comercialesQ.data ?? {}}
            />
          )}
          {tab === "Recursos" && (
            <RecursosTab recursos={recursosQ.data ?? []} esAdmin={rol === "admin"} />
          )}
          {tab === "Agenda" && <AgendaTab citas={citas} userId={user.id} />}
          {tab === "Perfil" && <PerfilTab perfil={perfil} rol={rol} />}
        </div>
      </main>
    </div>
  );
}
