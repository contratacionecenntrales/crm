-- Centro de Formación: sustituye la Academia plana (formaciones sueltas) por
-- cursos con módulos (PDF/vídeo), cuestionario de evaluación y seguimiento
-- de progreso por comercial, incluyendo la posibilidad de marcar un curso
-- como obligatorio. El bucket de Storage "formaciones" se reutiliza tal
-- cual para alojar el material de los nuevos módulos.

DROP POLICY IF EXISTS "Formaciones publicadas visibles para el equipo" ON public.formaciones;
DROP POLICY IF EXISTS "Solo admin gestiona formaciones" ON public.formaciones;
DROP TABLE IF EXISTS public.formaciones;

CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  obligatorio boolean NOT NULL DEFAULT false,
  publicado boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cursos publicados visibles para el equipo" ON public.cursos
FOR SELECT TO authenticated USING (publicado = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admin gestiona cursos" ON public.cursos
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.modulos_curso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  archivo_url text,
  video_url text,
  tamano text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modulos_curso_material_check CHECK (archivo_url IS NOT NULL OR video_url IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_curso TO authenticated;
GRANT ALL ON public.modulos_curso TO service_role;
ALTER TABLE public.modulos_curso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modulos visibles para el equipo" ON public.modulos_curso
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.id = curso_id AND (c.publicado = true OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "Solo admin gestiona modulos" ON public.modulos_curso
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.preguntas_curso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  enunciado text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preguntas_curso TO authenticated;
GRANT ALL ON public.preguntas_curso TO service_role;
ALTER TABLE public.preguntas_curso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Preguntas visibles para el equipo" ON public.preguntas_curso
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.id = curso_id AND (c.publicado = true OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "Solo admin gestiona preguntas" ON public.preguntas_curso
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.opciones_pregunta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES public.preguntas_curso(id) ON DELETE CASCADE,
  texto text NOT NULL,
  es_correcta boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opciones_pregunta TO authenticated;
GRANT ALL ON public.opciones_pregunta TO service_role;
ALTER TABLE public.opciones_pregunta ENABLE ROW LEVEL SECURITY;

-- Nota: la RLS es a nivel de fila, no de columna, así que "es_correcta" es
-- técnicamente legible para cualquier autenticado (p.ej. inspeccionando la
-- respuesta de red). Es un cuestionario formativo interno, no un examen con
-- validez legal, así que se acepta ese límite; lo que sí queda garantizado
-- es que nadie puede falsear su propio resultado, porque enviar_cuestionario
-- corrige en el servidor y resultados_cuestionario no admite escritura
-- directa del cliente.
CREATE POLICY "Opciones visibles para el equipo" ON public.opciones_pregunta
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.preguntas_curso p
    JOIN public.cursos c ON c.id = p.curso_id
    WHERE p.id = pregunta_id AND (c.publicado = true OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "Solo admin gestiona opciones" ON public.opciones_pregunta
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.progreso_modulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos_curso(id) ON DELETE CASCADE,
  completado_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modulo_id)
);
GRANT SELECT, INSERT, DELETE ON public.progreso_modulo TO authenticated;
GRANT ALL ON public.progreso_modulo TO service_role;
ALTER TABLE public.progreso_modulo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver progreso propio o admin" ON public.progreso_modulo
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Marcar progreso propio" ON public.progreso_modulo
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Desmarcar progreso propio" ON public.progreso_modulo
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.resultados_cuestionario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  aciertos integer NOT NULL,
  total integer NOT NULL,
  aprobado boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curso_id)
);
-- Sin INSERT/UPDATE para authenticated: el resultado solo lo escribe la
-- función enviar_cuestionario (como definer), para que nadie pueda
-- reportarse a sí mismo un cuestionario obligatorio como aprobado.
GRANT SELECT ON public.resultados_cuestionario TO authenticated;
GRANT ALL ON public.resultados_cuestionario TO service_role;
ALTER TABLE public.resultados_cuestionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver resultados propios o admin" ON public.resultados_cuestionario
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Corrige el cuestionario en el servidor: recibe [{pregunta_id, opcion_id}]
-- y calcula aciertos/aprobado (>=70%) comparando contra la opción marcada
-- es_correcta, sin que el cliente pueda falsear la nota.
CREATE OR REPLACE FUNCTION public.enviar_cuestionario(p_curso_id uuid, p_respuestas jsonb)
RETURNS TABLE(aciertos integer, total integer, aprobado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_aciertos integer;
  v_aprobado boolean;
BEGIN
  SELECT count(*) INTO v_total FROM public.preguntas_curso WHERE curso_id = p_curso_id;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'Este curso no tiene cuestionario';
  END IF;

  SELECT count(*) INTO v_aciertos
  FROM public.preguntas_curso p
  JOIN public.opciones_pregunta o ON o.pregunta_id = p.id AND o.es_correcta = true
  WHERE p.curso_id = p_curso_id
    AND o.id = (
      SELECT (elem ->> 'opcion_id')::uuid
      FROM jsonb_array_elements(p_respuestas) elem
      WHERE (elem ->> 'pregunta_id')::uuid = p.id
    );

  v_aprobado := v_aciertos::numeric / v_total::numeric >= 0.7;

  INSERT INTO public.resultados_cuestionario (user_id, curso_id, aciertos, total, aprobado)
  VALUES (auth.uid(), p_curso_id, v_aciertos, v_total, v_aprobado)
  ON CONFLICT (user_id, curso_id) DO UPDATE
  SET aciertos = EXCLUDED.aciertos,
      total = EXCLUDED.total,
      aprobado = EXCLUDED.aprobado,
      created_at = now();

  RETURN QUERY SELECT v_aciertos, v_total, v_aprobado;
END;
$$;
REVOKE ALL ON FUNCTION public.enviar_cuestionario(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_cuestionario(uuid, jsonb) TO authenticated;
