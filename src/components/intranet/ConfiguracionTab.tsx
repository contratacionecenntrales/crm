import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Recurso } from "./RecursosTab";
import type { Formacion } from "./AcademiaTab";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  esAdmin: boolean;
};

const TAMANO_MAXIMO_PDF = 30 * 1024 * 1024; // 30 MB

function sanitizarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-100);
}

export function ConfiguracionTab({
  objetivoDefecto,
  comisionPorcentajeDefecto,
  recursos,
  formaciones,
  usuarios,
  currentUserId,
}: {
  objetivoDefecto: number;
  comisionPorcentajeDefecto: number;
  recursos: Recurso[];
  formaciones: Formacion[];
  usuarios: Usuario[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ObjetivoDefectoCard
          objetivoDefecto={objetivoDefecto}
          comisionPorcentajeDefecto={comisionPorcentajeDefecto}
        />
        <RolesCard usuarios={usuarios} currentUserId={currentUserId} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <FormacionesCard formaciones={formaciones} />
        <RecursosCard recursos={recursos} />
      </div>
    </div>
  );
}

function ObjetivoDefectoCard({
  objetivoDefecto,
  comisionPorcentajeDefecto,
}: {
  objetivoDefecto: number;
  comisionPorcentajeDefecto: number;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(String(objetivoDefecto));
  const [porcentaje, setPorcentaje] = useState(String(comisionPorcentajeDefecto));

  const guardar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("configuracion")
        .update({
          objetivo_trimestral_defecto: Number(valor.replace(",", ".")) || 0,
          comision_porcentaje_defecto: Number(porcentaje.replace(",", ".")) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajustes por defecto actualizados");
      qc.invalidateQueries({ queryKey: ["configuracion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Ajustes por defecto</h2>
      <p className="text-xs text-ink-500">
        Se aplican a cada comercial nuevo y a cada comisión generada automáticamente.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Objetivo trimestral €
          </span>
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-40 rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Comisión %
          </span>
          <input
            inputMode="decimal"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className="w-28 rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
          />
        </label>
        <button
          type="submit"
          disabled={guardar.isPending}
          className="rounded-xl bg-brand px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {guardar.isPending ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </section>
  );
}

function RolesCard({ usuarios, currentUserId }: { usuarios: Usuario[]; currentUserId: string }) {
  const qc = useQueryClient();

  const cambiarRol = useMutation({
    mutationFn: async ({ userId, aAdmin }: { userId: string; aAdmin: boolean }) => {
      if (aAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Comerciales y roles</h2>
      <p className="text-xs text-ink-500">Asciende o retira permisos de administrador.</p>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{u.nombre}</p>
              <p className="truncate text-[11px] text-ink-500">{u.email}</p>
            </div>
            <button
              disabled={u.id === currentUserId || cambiarRol.isPending}
              onClick={() => cambiarRol.mutate({ userId: u.id, aAdmin: !u.esAdmin })}
              title={u.id === currentUserId ? "No puedes cambiar tu propio rol" : undefined}
              className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-50 ${
                u.esAdmin ? "bg-accent/15 text-accent" : "bg-secondary text-ink-400"
              }`}
            >
              {u.esAdmin ? "Admin · quitar" : "Hacer admin"}
            </button>
          </div>
        ))}
        {usuarios.length === 0 && <p className="py-6 text-sm text-ink-500">Sin comerciales.</p>}
      </div>
    </section>
  );
}

function FormacionesCard({ formaciones }: { formaciones: Formacion[] }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [videoUrl, setVideoUrl] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  function onArchivoChange(file: File | null) {
    if (!file) {
      setArchivo(null);
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Solo se admiten archivos PDF");
      return;
    }
    if (file.size > TAMANO_MAXIMO_PDF) {
      toast.error("El archivo supera el tamaño máximo de 30 MB");
      return;
    }
    setArchivo(file);
  }

  const publicar = useMutation({
    mutationFn: async () => {
      if (!archivo && !videoUrl.trim()) {
        throw new Error("Adjunta un PDF o un enlace de vídeo");
      }
      let archivo_url: string | null = null;
      let tamano: string | null = null;
      if (archivo) {
        const ruta = `${crypto.randomUUID()}-${sanitizarNombreArchivo(archivo.name)}`;
        const { error } = await supabase.storage
          .from("formaciones")
          .upload(ruta, archivo, { contentType: archivo.type });
        if (error) throw error;
        archivo_url = ruta;
        tamano = (archivo.size / (1024 * 1024)).toFixed(1) + " MB";
      }
      const { error } = await supabase.from("formaciones").insert({
        titulo,
        descripcion: descripcion || null,
        categoria,
        archivo_url,
        video_url: videoUrl.trim() || null,
        tamano,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formación publicada");
      setTitulo("");
      setDescripcion("");
      setCategoria("General");
      setVideoUrl("");
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["formaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublicado = useMutation({
    mutationFn: async ({ id, publicado }: { id: string; publicado: boolean }) => {
      const { error } = await supabase.from("formaciones").update({ publicado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formaciones"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("formaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Formación eliminada");
      qc.invalidateQueries({ queryKey: ["formaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Academia</h2>
      <p className="text-xs text-ink-500">Publica formaciones (PDF y/o vídeo).</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          publicar.mutate();
        }}
      >
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción breve"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Categoría"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Enlace de vídeo (opcional)"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => onArchivoChange(e.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink-400 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:font-semibold file:text-brand focus:border-brand"
        />
        <span className="block text-[10px] text-ink-500">PDF opcional · máx. 30 MB</span>
        <button
          type="submit"
          disabled={publicar.isPending}
          className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {publicar.isPending ? "Publicando…" : "Publicar formación"}
        </button>
      </form>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {formaciones.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{f.titulo}</p>
              <p className="truncate text-[11px] text-ink-500">{f.categoria}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => togglePublicado.mutate({ id: f.id, publicado: !f.publicado })}
                className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
                  f.publicado ? "bg-lime/15 text-lime" : "bg-secondary text-ink-400"
                }`}
              >
                {f.publicado ? "Publicada" : "Borrador"}
              </button>
              <button
                onClick={() => eliminar.mutate(f.id)}
                className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-coral hover:bg-coral/10"
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
        {formaciones.length === 0 && (
          <p className="py-6 text-sm text-ink-500">Sin formaciones todavía.</p>
        )}
      </div>
    </section>
  );
}

function RecursosCard({ recursos }: { recursos: Recurso[] }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [archivo, setArchivo] = useState<File | null>(null);

  function onArchivoChange(file: File | null) {
    if (!file) {
      setArchivo(null);
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Solo se admiten archivos PDF");
      return;
    }
    if (file.size > TAMANO_MAXIMO_PDF) {
      toast.error("El archivo supera el tamaño máximo de 30 MB");
      return;
    }
    setArchivo(file);
  }

  const subir = useMutation({
    mutationFn: async () => {
      if (!archivo) throw new Error("Selecciona un PDF");
      const ruta = `${crypto.randomUUID()}-${sanitizarNombreArchivo(archivo.name)}`;
      const { error: errorSubida } = await supabase.storage
        .from("recursos")
        .upload(ruta, archivo, { contentType: archivo.type });
      if (errorSubida) throw errorSubida;

      const tamanoMb = (archivo.size / (1024 * 1024)).toFixed(1) + " MB";
      const { error } = await supabase.from("recursos").insert({
        titulo,
        descripcion: descripcion || null,
        categoria,
        archivo_url: ruta,
        tamano: tamanoMb,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recurso publicado");
      setTitulo("");
      setDescripcion("");
      setCategoria("General");
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["recursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recursos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recurso eliminado");
      qc.invalidateQueries({ queryKey: ["recursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Recursos</h2>
      <p className="text-xs text-ink-500">Documentos corporativos descargables (PDF).</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          subir.mutate();
        }}
      >
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción breve"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Categoría"
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(e) => onArchivoChange(e.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink-400 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:font-semibold file:text-brand focus:border-brand"
        />
        <span className="block text-[10px] text-ink-500">PDF · máx. 30 MB</span>
        <button
          type="submit"
          disabled={subir.isPending}
          className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {subir.isPending ? "Publicando…" : "Publicar recurso"}
        </button>
      </form>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {recursos.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-100">{r.titulo}</p>
              <p className="truncate text-[11px] text-ink-500">{r.categoria}</p>
            </div>
            <button
              onClick={() => eliminar.mutate(r.id)}
              className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-coral hover:bg-coral/10"
            >
              Borrar
            </button>
          </div>
        ))}
        {recursos.length === 0 && (
          <p className="py-6 text-sm text-ink-500">Sin recursos todavía.</p>
        )}
      </div>
    </section>
  );
}
