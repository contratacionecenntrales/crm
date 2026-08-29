import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Recurso = {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  archivo_url: string;
  tamano: string | null;
};

const TAMANO_MAXIMO = 20 * 1024 * 1024; // 20 MB

async function abrirRecurso(archivoUrl: string) {
  if (/^https?:\/\//i.test(archivoUrl)) {
    window.open(archivoUrl, "_blank", "noopener");
    return;
  }
  const { data, error } = await supabase.storage.from("recursos").createSignedUrl(archivoUrl, 60);
  if (error || !data) {
    toast.error("No se pudo abrir el recurso");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function RecursosTab({ recursos, esAdmin }: { recursos: Recurso[]; esAdmin: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {esAdmin && (
        <div className="lg:col-span-1">
          <SubirRecursoForm />
        </div>
      )}
      <section
        className={`rounded-2xl border border-line bg-panel p-5 ${esAdmin ? "lg:col-span-2" : "lg:col-span-3"}`}
      >
        <h2 className="text-lg font-semibold text-ink-100">Recursos y PDFs</h2>
        <p className="text-xs text-ink-500">Descarga con un clic</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {recursos.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{r.titulo}</p>
                {r.descripcion && (
                  <p className="mt-0.5 text-[11px] text-ink-400">{r.descripcion}</p>
                )}
                <p className="mt-1 font-mono text-[11px] text-ink-500">
                  {r.categoria}
                  {r.tamano ? ` · ${r.tamano}` : ""}
                </p>
              </div>
              <button
                onClick={() => abrirRecurso(r.archivo_url)}
                aria-label={`Descargar ${r.titulo}`}
                className="rounded-lg bg-brand/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-brand transition hover:bg-brand/25"
              >
                ↧
              </button>
            </div>
          ))}
          {recursos.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500 sm:col-span-2">
              Administración aún no ha publicado documentos.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SubirRecursoForm() {
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
    if (file.size > TAMANO_MAXIMO) {
      toast.error("El archivo supera el tamaño máximo de 20 MB");
      return;
    }
    setArchivo(file);
  }

  const subir = useMutation({
    mutationFn: async () => {
      if (!archivo) throw new Error("Selecciona un PDF");
      const nombre = archivo.name
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "_")
        .slice(-100);
      const ruta = `${crypto.randomUUID()}-${nombre}`;
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

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Publicar recurso</h2>
      <p className="text-xs text-ink-500">Solo administración puede publicar documentos.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          subir.mutate();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Título
          </span>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Tarifario 2027.pdf"
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Descripción
          </span>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción"
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Categoría
          </span>
          <input
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Archivo (PDF, máx. 20 MB)
          </span>
          <input
            required
            type="file"
            accept="application/pdf"
            onChange={(e) => onArchivoChange(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink-400 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:font-semibold file:text-brand focus:border-brand"
          />
        </label>
        <button
          type="submit"
          disabled={subir.isPending}
          className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-gold disabled:opacity-60"
        >
          {subir.isPending ? "Publicando…" : "Publicar recurso"}
        </button>
      </form>
    </section>
  );
}
