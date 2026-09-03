import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardTab } from "@/components/intranet/DashboardTab";
import { FacturacionTab, type Factura } from "@/components/intranet/FacturacionTab";
import { AgendaTab, type Cita } from "@/components/intranet/AgendaTab";
import { RecursosTab, type Recurso } from "@/components/intranet/RecursosTab";
import {
  AcademiaTab,
  type Curso,
  type ModuloCurso,
  type PreguntaCurso,
  type OpcionPregunta,
  type ProgresoModulo,
  type ResultadoCuestionario,
} from "@/components/intranet/AcademiaTab";
import { LeadsTab, type Lead } from "@/components/intranet/LeadsTab";
import {
  LiquidacionesTab,
  type Comision,
  type Liquidacion,
} from "@/components/intranet/LiquidacionesTab";
import { EntrevistasTab, type Candidato } from "@/components/intranet/EntrevistasTab";
import { BackofficeTab, type Ticket, type Campana } from "@/components/intranet/BackofficeTab";
import {
  ConfiguracionTab,
  type Usuario,
  type Permiso,
} from "@/components/intranet/ConfiguracionTab";
import { PerfilTab, type Perfil } from "@/components/intranet/PerfilTab";
import type { AppRole, Modulo } from "@/lib/intranet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intranet comercial Labs24k | Leads, facturación, agenda y academia" },
      {
        name: "description",
        content:
          "Portal privado del equipo comercial de Labs24k: CRM de leads, registro de facturación, agenda de citas, cursos y cuestionarios del Centro de Formación, descarga de PDFs corporativos y soporte directo con administración.",
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

const TABS_GATEADAS = [
  "Leads",
  "Facturación",
  "Comisiones",
  "Recursos",
  "Academia",
  "Agenda",
  "Entrevistas",
  "Backoffice",
] as const;
const TAB_MODULO: Record<(typeof TABS_GATEADAS)[number], Modulo> = {
  Leads: "leads",
  Facturación: "facturacion",
  Comisiones: "comisiones",
  Recursos: "recursos",
  Academia: "academia",
  Agenda: "agenda",
  Entrevistas: "entrevistas",
  Backoffice: "backoffice",
};
const TAB_CONFIGURACION = "Configuración" as const;
type Tab = "Dashboard" | (typeof TABS_GATEADAS)[number] | "Perfil" | typeof TAB_CONFIGURACION;

function Intranet() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const misRolesQ = useQuery({
    queryKey: ["misRoles", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const permisosQ = useQuery({
    queryKey: ["permisos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("permisos_modulo").select("role, modulo, acceso");
      if (error) throw error;
      return (data ?? []) as Permiso[];
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

  const leadsQ = useQuery({
    queryKey: ["leads", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, empresa, contacto, telefono, email, ciudad, sector, campana, notas, estado, asignado_a, creado_por, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const comisionesQ = useQuery({
    queryKey: ["comisiones", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comisiones")
        .select(
          "id, factura_id, user_id, concepto, importe, porcentaje, estado, liquidacion_id, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Comision[];
    },
  });

  const liquidacionesQ = useQuery({
    queryKey: ["liquidaciones", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liquidaciones")
        .select("id, user_id, importe_total, estado, created_at, pagada_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Liquidacion[];
    },
  });

  const usuariosQ = useQuery({
    queryKey: ["usuarios", uid],
    enabled: !!uid && rolQ.data === "admin",
    queryFn: async () => {
      const [{ data: perfilesData, error: perfilesError }, { data: rolesData, error: rolesError }] =
        await Promise.all([
          supabase.from("perfiles").select("id, nombre, email"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      if (perfilesError) throw perfilesError;
      if (rolesError) throw rolesError;
      return (perfilesData ?? []).map((p): Usuario => ({
        id: p.id,
        nombre: p.nombre,
        email: p.email,
        roles: (rolesData ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
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

  const cursosQ = useQuery({
    queryKey: ["cursos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, titulo, descripcion, obligatorio, publicado, orden")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Curso[];
    },
  });

  const modulosQ = useQuery({
    queryKey: ["modulos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos_curso")
        .select("id, curso_id, titulo, descripcion, archivo_url, video_url, tamano, orden")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ModuloCurso[];
    },
  });

  const preguntasQ = useQuery({
    queryKey: ["preguntas", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preguntas_curso")
        .select("id, curso_id, enunciado, orden")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PreguntaCurso[];
    },
  });

  const opcionesQ = useQuery({
    queryKey: ["opciones", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opciones_pregunta")
        .select("id, pregunta_id, texto, es_correcta, orden")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OpcionPregunta[];
    },
  });

  const progresoQ = useQuery({
    queryKey: ["progreso", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progreso_modulo")
        .select("id, user_id, modulo_id");
      if (error) throw error;
      return (data ?? []) as ProgresoModulo[];
    },
  });

  const resultadosQ = useQuery({
    queryKey: ["resultados", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultados_cuestionario")
        .select("id, user_id, curso_id, aciertos, total, aprobado");
      if (error) throw error;
      return (data ?? []) as ResultadoCuestionario[];
    },
  });

  const candidatosQ = useQuery({
    queryKey: ["candidatos", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidatos")
        .select(
          "id, nombre, email, telefono, puesto, fase, notas, entrevistador_id, creado_por, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Candidato[];
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["tickets", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, titulo, descripcion, estado, prioridad, creado_por, asignado_a, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const campanasQ = useQuery({
    queryKey: ["campanas", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanas")
        .select("id, nombre, presupuesto, activa")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Campana[];
    },
  });

  useEffect(() => {
    if (!uid) return;
    const canal = supabase
      .channel("backoffice-tiempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () =>
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () =>
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [uid, queryClient]);

  const configuracionQ = useQuery({
    queryKey: ["configuracion", uid],
    enabled: !!uid && rolQ.data === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion")
        .select("objetivo_trimestral_defecto, comision_porcentaje_defecto")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return {
        objetivoDefecto: data?.objetivo_trimestral_defecto ?? 55000,
        comisionPorcentajeDefecto: data?.comision_porcentaje_defecto ?? 10,
      };
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
  const usuarios = usuariosQ.data ?? [];
  const comerciales = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));
  const misRoles = misRolesQ.data ?? [];
  const permisos = permisosQ.data ?? [];
  const modulosPermitidos = new Set<Modulo>(
    rol === "admin"
      ? TABS_GATEADAS.map((t) => TAB_MODULO[t])
      : permisos
          .filter((p) => misRoles.includes(p.role) && p.acceso)
          .map((p) => p.modulo as Modulo),
  );
  const tabs: Tab[] = [
    "Dashboard",
    ...TABS_GATEADAS.filter((t) => modulosPermitidos.has(TAB_MODULO[t])),
    "Perfil",
    ...(rol === "admin" ? [TAB_CONFIGURACION] : []),
  ];
  const puedeGestionarTickets = rol === "admin" || misRoles.includes("admin_staff");
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
            <div className="grid size-10 place-items-center overflow-hidden rounded-lg bg-black glow-brand">
              <img src="/logo-mark.png" alt="Labs24k" className="size-full object-contain p-1" />
            </div>
            <div className="leading-tight">
              <p className="font-mono text-xs font-semibold tracking-[0.22em] text-brand text-glow-brand">
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
              Hola,{" "}
              <span className="text-brand text-glow-brand">{perfil.nombre.split(" ")[0]}</span>. Tu
              mes va por buen camino.
            </h1>
          </div>
          <div className="font-mono text-xs text-ink-400">
            <span className="text-lime">●</span> En línea &nbsp;·&nbsp;{" "}
            {new Date().toLocaleDateString("es-ES")}
          </div>
        </div>

        <nav className="mt-8 flex flex-wrap gap-2 border-b border-line pb-px">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                t === tab
                  ? "rounded-lg bg-brand/15 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-brand text-glow-brand glow-brand"
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
          {tab === "Leads" && (
            <LeadsTab
              leads={leadsQ.data ?? []}
              userId={user.id}
              esAdmin={rol === "admin"}
              comerciales={comerciales}
            />
          )}
          {tab === "Facturación" && (
            <FacturacionTab
              facturas={facturas}
              userId={user.id}
              esAdmin={rol === "admin"}
              comerciales={comerciales}
            />
          )}
          {tab === "Comisiones" && (
            <LiquidacionesTab
              comisiones={comisionesQ.data ?? []}
              liquidaciones={liquidacionesQ.data ?? []}
              userId={user.id}
              esAdmin={rol === "admin"}
              comerciales={comerciales}
            />
          )}
          {tab === "Recursos" && <RecursosTab recursos={recursosQ.data ?? []} />}
          {tab === "Academia" && (
            <AcademiaTab
              cursos={cursosQ.data ?? []}
              modulos={modulosQ.data ?? []}
              preguntas={preguntasQ.data ?? []}
              opciones={opcionesQ.data ?? []}
              progreso={progresoQ.data ?? []}
              resultados={resultadosQ.data ?? []}
              userId={user.id}
              esAdmin={rol === "admin"}
              comerciales={comerciales}
            />
          )}
          {tab === "Agenda" && <AgendaTab citas={citas} userId={user.id} />}
          {tab === "Entrevistas" && (
            <EntrevistasTab
              candidatos={candidatosQ.data ?? []}
              userId={user.id}
              comerciales={comerciales}
            />
          )}
          {tab === "Backoffice" && (
            <BackofficeTab
              leads={leadsQ.data ?? []}
              tickets={ticketsQ.data ?? []}
              campanas={campanasQ.data ?? []}
              userId={user.id}
              puedeGestionarTickets={puedeGestionarTickets}
              comerciales={comerciales}
            />
          )}
          {tab === "Perfil" && <PerfilTab perfil={perfil} rol={rol} />}
          {tab === "Configuración" && rol === "admin" && (
            <ConfiguracionTab
              objetivoDefecto={Number(configuracionQ.data?.objetivoDefecto ?? 55000)}
              comisionPorcentajeDefecto={Number(
                configuracionQ.data?.comisionPorcentajeDefecto ?? 10,
              )}
              recursos={recursosQ.data ?? []}
              usuarios={usuarios}
              permisos={permisos}
              currentUserId={user.id}
            />
          )}
        </div>
      </main>
    </div>
  );
}
