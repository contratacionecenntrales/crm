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

export function RecursosTab({ recursos }: { recursos: Recurso[] }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
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
              {r.descripcion && <p className="mt-0.5 text-[11px] text-ink-400">{r.descripcion}</p>}
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
  );
}
