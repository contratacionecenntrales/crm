-- Academia: formaciones (PDF y/o enlace de vídeo), publicadas por admin.
CREATE TABLE public.formaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  categoria text NOT NULL DEFAULT 'General',
  archivo_url text,
  video_url text,
  tamano text,
  publicado boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formaciones_material_check CHECK (archivo_url IS NOT NULL OR video_url IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formaciones TO authenticated;
GRANT ALL ON public.formaciones TO service_role;
ALTER TABLE public.formaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formaciones publicadas visibles para el equipo" ON public.formaciones
FOR SELECT TO authenticated USING (publicado = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admin gestiona formaciones" ON public.formaciones
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('formaciones', 'formaciones', false, 31457280, ARRAY['application/pdf']) -- 30 MB
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Formaciones storage lectura equipo" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'formaciones');
CREATE POLICY "Formaciones storage gestion admin" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'formaciones' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'formaciones' AND public.has_role(auth.uid(), 'admin'));

-- Configuración: fila única con ajustes editables desde el panel de admin.
CREATE TABLE public.configuracion (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  objetivo_trimestral_defecto numeric NOT NULL DEFAULT 55000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.configuracion TO authenticated;
GRANT ALL ON public.configuracion TO service_role;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo admin lee configuracion" ON public.configuracion
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Solo admin edita configuracion" ON public.configuracion
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.configuracion (id, objetivo_trimestral_defecto) VALUES (true, 55000);

-- El alta de usuario ahora toma el objetivo por defecto de configuracion en
-- vez de un valor fijo, para que el admin pueda cambiarlo desde el panel.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  objetivo_defecto numeric;
BEGIN
  SELECT objetivo_trimestral_defecto INTO objetivo_defecto FROM public.configuracion WHERE id = true;

  INSERT INTO public.perfiles (id, nombre, telefono, email, objetivo_trimestral)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'telefono', ''),
    COALESCE(NEW.email, ''),
    COALESCE(objetivo_defecto, 55000)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'comercial')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Gestión de roles: permite a un admin ascender/degradar comerciales desde
-- el panel de Configuración (antes solo se podía por SQL manual).
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "Admin asigna roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin retira roles" ON public.user_roles
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
