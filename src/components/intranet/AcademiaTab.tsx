import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Curso = {
  id: string;
  titulo: string;
  descripcion: string | null;
  obligatorio: boolean;
  publicado: boolean;
  orden: number;
};

export type ModuloCurso = {
  id: string;
  curso_id: string;
  titulo: string;
  descripcion: string | null;
  archivo_url: string | null;
  video_url: string | null;
  tamano: string | null;
  orden: number;
};

export type PreguntaCurso = {
  id: string;
  curso_id: string;
  enunciado: string;
  orden: number;
};

export type OpcionPregunta = {
  id: string;
  pregunta_id: string;
  texto: string;
  es_correcta: boolean;
  orden: number;
};

export type ProgresoModulo = {
  id: string;
  user_id: string;
  modulo_id: string;
};

export type ResultadoCuestionario = {
  id: string;
  user_id: string;
  curso_id: string;
  aciertos: number;
  total: number;
  aprobado: boolean;
};

const TAMANO_MAXIMO_PDF = 30 * 1024 * 1024; // 30 MB

function sanitizarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-100);
}

async function abrirPdf(ruta: string) {
  const { data, error } = await supabase.storage.from("formaciones").createSignedUrl(ruta, 60);
  if (error || !data) {
    toast.error("No se pudo abrir el documento");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

export function AcademiaTab({
  cursos,
  modulos,
  preguntas,
  opciones,
  progreso,
  resultados,
  userId,
  esAdmin,
  comerciales,
}: {
  cursos: Curso[];
  modulos: ModuloCurso[];
  preguntas: PreguntaCurso[];
  opciones: OpcionPregunta[];
  progreso: ProgresoModulo[];
  resultados: ResultadoCuestionario[];
  userId: string;
  esAdmin: boolean;
  comerciales: Record<string, string>;
}) {
  const cursosVisibles = useMemo(
    () =>
      cursos
        .filter((c) => c.publicado || esAdmin)
        .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo)),
    [cursos, esAdmin],
  );

  const misModulosCompletados = useMemo(
    () => new Set(progreso.filter((p) => p.user_id === userId).map((p) => p.modulo_id)),
    [progreso, userId],
  );
  const misResultados = useMemo(
    () => new Map(resultados.filter((r) => r.user_id === userId).map((r) => [r.curso_id, r])),
    [resultados, userId],
  );

  return (
    <div className="space-y-5">
      {esAdmin && (
        <CumplimientoObligatorios
          cursos={cursos}
          modulos={modulos}
          preguntas={preguntas}
          progreso={progreso}
          resultados={resultados}
          comerciales={comerciales}
        />
      )}

      {esAdmin && <NuevoCursoForm />}

      <div className="space-y-4">
        {cursosVisibles.map((curso) => (
          <CursoCard
            key={curso.id}
            curso={curso}
            modulos={modulos
              .filter((m) => m.curso_id === curso.id)
              .sort((a, b) => a.orden - b.orden)}
            preguntas={preguntas
              .filter((p) => p.curso_id === curso.id)
              .sort((a, b) => a.orden - b.orden)}
            opciones={opciones}
            modulosCompletados={misModulosCompletados}
            resultado={misResultados.get(curso.id) ?? null}
            esAdmin={esAdmin}
            userId={userId}
          />
        ))}
        {cursosVisibles.length === 0 && (
          <p className="rounded-2xl border border-line bg-panel py-10 text-center text-sm text-ink-500">
            Administración aún no ha publicado cursos.
          </p>
        )}
      </div>
    </div>
  );
}

function CursoCard({
  curso,
  modulos,
  preguntas,
  opciones,
  modulosCompletados,
  resultado,
  esAdmin,
  userId,
}: {
  curso: Curso;
  modulos: ModuloCurso[];
  preguntas: PreguntaCurso[];
  opciones: OpcionPregunta[];
  modulosCompletados: Set<string>;
  resultado: ResultadoCuestionario | null;
  esAdmin: boolean;
  userId: string;
}) {
  const [gestionar, setGestionar] = useState(false);
  const completados = modulos.filter((m) => modulosCompletados.has(m.id)).length;
  const cuestionarioOk = preguntas.length === 0 || resultado?.aprobado === true;
  const completo = completados === modulos.length && modulos.length > 0 && cuestionarioOk;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-100">{curso.titulo}</h2>
            {curso.obligatorio && (
              <span className="rounded-md bg-coral/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-coral">
                Obligatorio
              </span>
            )}
            {!curso.publicado && (
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                Borrador
              </span>
            )}
          </div>
          {curso.descripcion && <p className="mt-1 text-sm text-ink-400">{curso.descripcion}</p>}
        </div>
        <div className="flex items-center gap-2">
          {modulos.length > 0 && (
            <span className="font-mono text-[11px] text-ink-500">
              {completados}/{modulos.length} módulos
            </span>
          )}
          <span
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
              completo ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber"
            }`}
          >
            {completo ? "Completado" : "Pendiente"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {modulos.map((m) => (
          <ModuloItem
            key={m.id}
            modulo={m}
            completado={modulosCompletados.has(m.id)}
            userId={userId}
          />
        ))}
        {modulos.length === 0 && <p className="text-sm text-ink-500">Sin módulos todavía.</p>}
      </div>

      {preguntas.length > 0 && (
        <CuestionarioBloque
          curso={curso}
          preguntas={preguntas}
          opciones={opciones}
          resultado={resultado}
        />
      )}

      {esAdmin && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            onClick={() => setGestionar((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-widest text-brand hover:underline"
          >
            {gestionar ? "Ocultar gestión" : "Gestionar curso"}
          </button>
          {gestionar && (
            <GestionCurso
              curso={curso}
              modulos={modulos}
              preguntas={preguntas}
              opciones={opciones}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ModuloItem({
  modulo,
  completado,
  userId,
}: {
  modulo: ModuloCurso;
  completado: boolean;
  userId: string;
}) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: async () => {
      if (completado) {
        const { error } = await supabase
          .from("progreso_modulo")
          .delete()
          .eq("user_id", userId)
          .eq("modulo_id", modulo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("progreso_modulo")
          .insert({ user_id: userId, modulo_id: modulo.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progreso"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-100">{modulo.titulo}</p>
        {modulo.descripcion && (
          <p className="truncate text-[11px] text-ink-500">{modulo.descripcion}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {modulo.archivo_url && (
            <button
              onClick={() => abrirPdf(modulo.archivo_url!)}
              className="rounded-lg bg-brand/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-brand transition hover:bg-brand/25"
            >
              Ver PDF
            </button>
          )}
          {modulo.video_url && (
            <a
              href={modulo.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-accent transition hover:bg-accent/25"
            >
              Ver vídeo
            </a>
          )}
        </div>
      </div>
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest transition disabled:opacity-60 ${
          completado ? "bg-lime/15 text-lime" : "bg-secondary text-ink-400"
        }`}
      >
        {completado ? "Completado" : "Marcar visto"}
      </button>
    </div>
  );
}

function CuestionarioBloque({
  curso,
  preguntas,
  opciones,
  resultado,
}: {
  curso: Curso;
  preguntas: PreguntaCurso[];
  opciones: OpcionPregunta[];
  resultado: ResultadoCuestionario | null;
}) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  const enviar = useMutation({
    mutationFn: async () => {
      if (Object.keys(respuestas).length !== preguntas.length) {
        throw new Error("Responde todas las preguntas antes de enviar");
      }
      const payload = preguntas.map((p) => ({ pregunta_id: p.id, opcion_id: respuestas[p.id] }));
      const { data, error } = await supabase.rpc("enviar_cuestionario", {
        p_curso_id: curso.id,
        p_respuestas: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const r = Array.isArray(data) ? data[0] : data;
      toast[r?.aprobado ? "success" : "error"](
        `Resultado: ${r?.aciertos}/${r?.total} — ${r?.aprobado ? "Aprobado" : "No aprobado"}`,
      );
      setAbierto(false);
      qc.invalidateQueries({ queryKey: ["resultados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-100">Cuestionario de evaluación</p>
        {resultado && (
          <span
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
              resultado.aprobado ? "bg-lime/15 text-lime" : "bg-coral/15 text-coral"
            }`}
          >
            Último intento: {resultado.aciertos}/{resultado.total}
          </span>
        )}
      </div>

      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="mt-3 rounded-lg bg-brand px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-primary-foreground glow-brand"
        >
          {resultado ? "Repetir cuestionario" : "Empezar cuestionario"}
        </button>
      ) : (
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            enviar.mutate();
          }}
        >
          {preguntas.map((p) => (
            <div key={p.id}>
              <p className="text-sm text-ink-200">{p.enunciado}</p>
              <div className="mt-2 space-y-1.5">
                {opciones
                  .filter((o) => o.pregunta_id === p.id)
                  .sort((a, b) => a.orden - b.orden)
                  .map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-200"
                    >
                      <input
                        type="radio"
                        name={`pregunta-${p.id}`}
                        checked={respuestas[p.id] === o.id}
                        onChange={() => setRespuestas((r) => ({ ...r, [p.id]: o.id }))}
                      />
                      {o.texto}
                    </label>
                  ))}
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={enviar.isPending}
            className="rounded-lg bg-brand px-4 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
          >
            {enviar.isPending ? "Enviando…" : "Enviar respuestas"}
          </button>
        </form>
      )}
    </div>
  );
}

function NuevoCursoForm() {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [obligatorio, setObligatorio] = useState(false);

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cursos").insert({
        titulo,
        descripcion: descripcion || null,
        obligatorio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso creado como borrador");
      setTitulo("");
      setDescripcion("");
      setObligatorio(false);
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Nuevo curso</h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          crear.mutate();
        }}
      >
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título del curso"
          className="min-w-[220px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción breve"
          className="min-w-[220px] flex-1 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
        />
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <input
            type="checkbox"
            checked={obligatorio}
            onChange={(e) => setObligatorio(e.target.checked)}
          />
          Obligatorio
        </label>
        <button
          type="submit"
          disabled={crear.isPending}
          className="rounded-xl bg-brand px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
        >
          {crear.isPending ? "Creando…" : "Crear curso"}
        </button>
      </form>
    </section>
  );
}

function GestionCurso({
  curso,
  modulos,
  preguntas,
  opciones,
}: {
  curso: Curso;
  modulos: ModuloCurso[];
  preguntas: PreguntaCurso[];
  opciones: OpcionPregunta[];
}) {
  const qc = useQueryClient();

  const actualizarCurso = useMutation({
    mutationFn: async (cambios: Partial<Pick<Curso, "publicado" | "obligatorio">>) => {
      const { error } = await supabase.from("cursos").update(cambios).eq("id", curso.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cursos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminarCurso = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cursos").delete().eq("id", curso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso eliminado");
      qc.invalidateQueries({ queryKey: ["cursos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <input
            type="checkbox"
            checked={curso.publicado}
            onChange={(e) => actualizarCurso.mutate({ publicado: e.target.checked })}
          />
          Publicado
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <input
            type="checkbox"
            checked={curso.obligatorio}
            onChange={(e) => actualizarCurso.mutate({ obligatorio: e.target.checked })}
          />
          Obligatorio
        </label>
        <button
          onClick={() => eliminarCurso.mutate()}
          className="font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
        >
          Eliminar curso
        </button>
      </div>

      <NuevoModuloForm cursoId={curso.id} />
      <div className="space-y-1.5">
        {modulos.map((m) => (
          <ModuloAdminItem key={m.id} modulo={m} />
        ))}
      </div>

      <NuevaPreguntaForm cursoId={curso.id} />
      <div className="space-y-2">
        {preguntas.map((p) => (
          <PreguntaAdminItem
            key={p.id}
            pregunta={p}
            opciones={opciones.filter((o) => o.pregunta_id === p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function NuevoModuloForm({ cursoId }: { cursoId: string }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
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

  const crear = useMutation({
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
      const { error } = await supabase.from("modulos_curso").insert({
        curso_id: cursoId,
        titulo,
        descripcion: descripcion || null,
        archivo_url,
        video_url: videoUrl.trim() || null,
        tamano,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo añadido");
      setTitulo("");
      setDescripcion("");
      setVideoUrl("");
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["modulos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-2 rounded-xl border border-line bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate();
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400">Añadir módulo</p>
      <input
        required
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título del módulo"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
      />
      <input
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción breve"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
      />
      <input
        type="url"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Enlace de vídeo (opcional)"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
      />
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => onArchivoChange(e.target.files?.[0] ?? null)}
        className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-ink-400 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1 file:font-mono file:text-[11px] file:font-semibold file:text-brand"
      />
      <button
        type="submit"
        disabled={crear.isPending}
        className="rounded-lg bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
      >
        {crear.isPending ? "Guardando…" : "Añadir módulo"}
      </button>
    </form>
  );
}

function ModuloAdminItem({ modulo }: { modulo: ModuloCurso }) {
  const qc = useQueryClient();
  const eliminar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("modulos_curso").delete().eq("id", modulo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modulos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
      <p className="truncate text-sm text-ink-200">{modulo.titulo}</p>
      <button
        onClick={() => eliminar.mutate()}
        className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
      >
        Borrar
      </button>
    </div>
  );
}

function NuevaPreguntaForm({ cursoId }: { cursoId: string }) {
  const qc = useQueryClient();
  const [enunciado, setEnunciado] = useState("");
  const [opcionesTexto, setOpcionesTexto] = useState(["", "", "", ""]);
  const [correcta, setCorrecta] = useState(0);

  const crear = useMutation({
    mutationFn: async () => {
      const textos = opcionesTexto.map((t) => t.trim());
      if (textos.some((t) => !t)) throw new Error("Rellena las 4 opciones");
      const { data: pregunta, error } = await supabase
        .from("preguntas_curso")
        .insert({ curso_id: cursoId, enunciado })
        .select("id")
        .single();
      if (error) throw error;
      const { error: errorOpciones } = await supabase.from("opciones_pregunta").insert(
        textos.map((texto, i) => ({
          pregunta_id: pregunta.id,
          texto,
          es_correcta: i === correcta,
          orden: i,
        })),
      );
      if (errorOpciones) throw errorOpciones;
    },
    onSuccess: () => {
      toast.success("Pregunta añadida");
      setEnunciado("");
      setOpcionesTexto(["", "", "", ""]);
      setCorrecta(0);
      qc.invalidateQueries({ queryKey: ["preguntas"] });
      qc.invalidateQueries({ queryKey: ["opciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-2 rounded-xl border border-line bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        crear.mutate();
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-400">
        Añadir pregunta (test de 4 opciones)
      </p>
      <input
        required
        value={enunciado}
        onChange={(e) => setEnunciado(e.target.value)}
        placeholder="Enunciado de la pregunta"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
      />
      {opcionesTexto.map((texto, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name={`correcta-${cursoId}`}
            checked={correcta === i}
            onChange={() => setCorrecta(i)}
            title="Marcar como correcta"
          />
          <input
            required
            value={texto}
            onChange={(e) =>
              setOpcionesTexto((prev) => prev.map((t, idx) => (idx === i ? e.target.value : t)))
            }
            placeholder={`Opción ${i + 1}`}
            className="flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={crear.isPending}
        className="rounded-lg bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
      >
        {crear.isPending ? "Guardando…" : "Añadir pregunta"}
      </button>
    </form>
  );
}

function PreguntaAdminItem({
  pregunta,
  opciones,
}: {
  pregunta: PreguntaCurso;
  opciones: OpcionPregunta[];
}) {
  const qc = useQueryClient();
  const eliminar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("preguntas_curso").delete().eq("id", pregunta.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preguntas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-200">{pregunta.enunciado}</p>
        <button
          onClick={() => eliminar.mutate()}
          className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-coral hover:underline"
        >
          Borrar
        </button>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {opciones
          .sort((a, b) => a.orden - b.orden)
          .map((o) => (
            <li
              key={o.id}
              className={`text-[11px] ${o.es_correcta ? "font-semibold text-lime" : "text-ink-500"}`}
            >
              {o.es_correcta ? "✓ " : "— "}
              {o.texto}
            </li>
          ))}
      </ul>
    </div>
  );
}

function CumplimientoObligatorios({
  cursos,
  modulos,
  preguntas,
  progreso,
  resultados,
  comerciales,
}: {
  cursos: Curso[];
  modulos: ModuloCurso[];
  preguntas: PreguntaCurso[];
  progreso: ProgresoModulo[];
  resultados: ResultadoCuestionario[];
  comerciales: Record<string, string>;
}) {
  const obligatorios = cursos.filter((c) => c.obligatorio && c.publicado);
  if (obligatorios.length === 0) return null;

  function completoPara(cursoId: string, userId: string) {
    const modulosCurso = modulos.filter((m) => m.curso_id === cursoId);
    const preguntasCurso = preguntas.filter((p) => p.curso_id === cursoId);
    const modulosOk =
      modulosCurso.length > 0 &&
      modulosCurso.every((m) => progreso.some((p) => p.modulo_id === m.id && p.user_id === userId));
    const cuestionarioOk =
      preguntasCurso.length === 0 ||
      resultados.some((r) => r.curso_id === cursoId && r.user_id === userId && r.aprobado);
    return modulosOk && cuestionarioOk;
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold text-ink-100">Cumplimiento de cursos obligatorios</h2>
      <div className="mt-4 space-y-4">
        {obligatorios.map((curso) => (
          <div key={curso.id}>
            <p className="mb-2 text-sm font-medium text-ink-200">{curso.titulo}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(comerciales).map(([id, nombre]) => (
                <span
                  key={id}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${
                    completoPara(curso.id, id) ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber"
                  }`}
                >
                  {nombre}
                </span>
              ))}
              {Object.keys(comerciales).length === 0 && (
                <span className="text-xs text-ink-500">Sin comerciales.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
