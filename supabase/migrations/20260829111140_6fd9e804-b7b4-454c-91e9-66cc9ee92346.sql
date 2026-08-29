CREATE TYPE public.app_role AS ENUM ('admin', 'comercial');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Ver los propios roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  objetivo_trimestral numeric NOT NULL DEFAULT 55000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.perfiles TO authenticated;
GRANT ALL ON public.perfiles TO service_role;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver perfil propio o admin" ON public.perfiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Actualizar perfil propio" ON public.perfiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Crear perfil propio" ON public.perfiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TYPE public.estado_factura AS ENUM ('Pendiente', 'Aprobada', 'Pagada');

CREATE TABLE public.facturacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  cliente text NOT NULL,
  importe numeric NOT NULL DEFAULT 0,
  fecha date NOT NULL DEFAULT current_date,
  comprobante text,
  estado public.estado_factura NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturacion TO authenticated;
GRANT ALL ON public.facturacion TO service_role;
ALTER TABLE public.facturacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver facturas propias o admin" ON public.facturacion
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Crear facturas propias" ON public.facturacion
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Editar facturas propias" ON public.facturacion
FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Borrar facturas propias" ON public.facturacion
FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.proteger_estado_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo administracion puede cambiar el estado de una factura';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_proteger_estado_factura
BEFORE UPDATE ON public.facturacion
FOR EACH ROW EXECUTE FUNCTION public.proteger_estado_factura();

CREATE TYPE public.estado_cita AS ENUM ('Pendiente', 'Realizada', 'Cerrada', 'Cancelada');

CREATE TABLE public.citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente text NOT NULL,
  fecha_cita timestamptz NOT NULL DEFAULT now(),
  ubicacion text,
  notas text,
  resultado text,
  estado public.estado_cita NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citas TO authenticated;
GRANT ALL ON public.citas TO service_role;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver citas propias o admin" ON public.citas
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Crear citas propias" ON public.citas
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Editar citas propias" ON public.citas
FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Borrar citas propias" ON public.citas
FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  categoria text NOT NULL DEFAULT 'General',
  archivo_url text NOT NULL,
  tamano text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos TO authenticated;
GRANT ALL ON public.recursos TO service_role;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recursos visibles para el equipo" ON public.recursos
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin gestiona recursos" ON public.recursos
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, telefono, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'telefono', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'comercial')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Comprobantes propios lectura" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'comprobantes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Comprobantes propios subida" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Recursos lectura equipo" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'recursos');
CREATE POLICY "Recursos gestion admin" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recursos' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.recursos (titulo, descripcion, categoria, archivo_url, tamano) VALUES
('Contrato tipo 2026.pdf', 'Modelo de contrato estandar para nuevos clientes.', 'Contratos', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '2.4 MB'),
('Guion de objeciones.pdf', 'Respuestas a las objeciones mas frecuentes en visita comercial.', 'Formacion', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '1.1 MB'),
('Folleto comercial H2.pdf', 'Folleto de producto para entregar en visita.', 'Marketing', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '5.8 MB'),
('Tarifario 2026.pdf', 'Tarifas oficiales y margenes de negociacion.', 'Comercial', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '0.9 MB');