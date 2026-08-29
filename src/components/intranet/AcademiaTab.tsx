import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Formacion = {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  archivo_url: string | null;
  video_url: string | null;
  tamano: string | null;
  publicado: boolean;
  orden: number;
};

async function abrirPdf(ruta: string) {
  const { data, error } = await supabase.storage.from("formaciones").createSignedUrl(ruta, 60);
  if (error || !data) {
    toast.error("No se pudo abrir el documento");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function AcademiaTab({ formaciones }: { formaciones: Formacion[] }) {
  const publicadas = formaciones
    .filter((f) => f.publicado)
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Academia</h2>
      <p className="text-xs text-ink-500">Formaciones y material de estudio del equipo.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {publicadas.map((f) => (
          <div key={f.id} className="rounded-xl border border-line bg-card p-3.5">
            <p className="text-sm font-medium text-ink-100">{f.titulo}</p>
            {f.descripcion && <p className="mt-0.5 text-[11px] text-ink-400">{f.descripcion}</p>}
            <p className="mt-1 font-mono text-[11px] text-ink-500">
              {f.categoria}
              {f.tamano ? ` · ${f.tamano}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {f.archivo_url && (
                <button
                  onClick={() => abrirPdf(f.archivo_url!)}
                  className="rounded-lg bg-brand/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-brand transition hover:bg-brand/25"
                >
                  Ver PDF
                </button>
              )}
              {f.video_url && (
                <a
                  href={f.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-accent/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-accent transition hover:bg-accent/25"
                >
                  Ver vídeo
                </a>
              )}
            </div>
          </div>
        ))}
        {publicadas.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-500 sm:col-span-2">
            Administración aún no ha publicado formaciones.
          </p>
        )}
      </div>
    </section>
  );
}
