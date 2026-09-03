-- Fase 4: matriz de permisos por módulo, Sala de Entrevistas (pipeline de
-- candidatos con fase de onboarding) y Backoffice (tickets internos y
-- gestión de campañas).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Permisos: qué rol ve qué pestaña/módulo. Admin siempre tiene acceso total
-- desde la propia app (no depende de esta tabla para no poder autobloquearse);
-- el resto de roles se rige por esta matriz, editable desde Configuración.
CREATE TABLE public.permisos_modulo (
  role public.app_role NOT NULL,
  modulo text NOT NULL,
  acceso boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, modulo)
);
GRANT SELECT, INSERT, UPDATE ON public.permisos_modulo TO authenticated;
GRANT ALL ON public.permisos_modulo TO service_role;
ALTER TABLE public.permisos_modulo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permisos visibles para el equipo" ON public.permisos_modulo
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin gestiona permisos" ON public.permisos_modulo
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.permisos_modulo (role, modulo, acceso) VALUES
  ('admin', 'leads', true), ('admin', 'facturacion', true), ('admin', 'comisiones', true),
  ('admin', 'recursos', true), ('admin', 'academia', true), ('admin', 'agenda', true),
  ('admin', 'entrevistas', true), ('admin', 'backoffice', true),
  ('comercial', 'leads', true), ('comercial', 'facturacion', true), ('comercial', 'comisiones', true),
  ('comercial', 'recursos', true), ('comercial', 'academia', true), ('comercial', 'agenda', true),
  ('comercial', 'entrevistas', false), ('comercial', 'backoffice', false),
  ('account_manager', 'leads', true), ('account_manager', 'facturacion', true),
  ('account_manager', 'comisiones', true), ('account_manager', 'recursos', true),
  ('account_manager', 'academia', true), ('account_manager', 'agenda', true),
  ('account_manager', 'entrevistas', false), ('account_manager', 'backoffice', true),
  ('entrevistador', 'leads', false), ('entrevistador', 'facturacion', false),
  ('entrevistador', 'comisiones', false), ('entrevistador', 'recursos', true),
  ('entrevistador', 'academia', true), ('entrevistador', 'agenda', false),
  ('entrevistador', 'entrevistas', true), ('entrevistador', 'backoffice', false),
  ('admin_staff', 'leads', false), ('admin_staff', 'facturacion', false),
  ('admin_staff', 'comisiones', false), ('admin_staff', 'recursos', true),
  ('admin_staff', 'academia', true), ('admin_staff', 'agenda', false),
  ('admin_staff', 'entrevistas', true), ('admin_staff', 'backoffice', true);

-- Sala de Entrevistas: pipeline de candidatos tipo kanban, con fase de
-- onboarding tras la contratación.
CREATE TYPE public.fase_candidato AS ENUM (
  'Recibido', 'Entrevista', 'Prueba', 'Oferta', 'Contratado', 'Onboarding', 'Descartado'
);

CREATE TABLE public.candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text,
  telefono text,
  puesto text NOT NULL,
  fase public.fase_candidato NOT NULL DEFAULT 'Recibido',
  notas text,
  entrevistador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidatos TO authenticated;
GRANT ALL ON public.candidatos TO service_role;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipo de seleccion gestiona candidatos" ON public.candidatos
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'entrevistador')
  OR public.has_role(auth.uid(), 'admin_staff')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'entrevistador')
  OR public.has_role(auth.uid(), 'admin_staff')
);

CREATE TRIGGER trg_candidatos_updated_at BEFORE UPDATE ON public.candidatos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backoffice: tickets internos de soporte y gestión de campañas.
CREATE TYPE public.estado_ticket AS ENUM ('Abierto', 'En proceso', 'Resuelto', 'Cerrado');
CREATE TYPE public.prioridad_ticket AS ENUM ('Baja', 'Media', 'Alta');

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  estado public.estado_ticket NOT NULL DEFAULT 'Abierto',
  prioridad public.prioridad_ticket NOT NULL DEFAULT 'Media',
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asignado_a uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver tickets propios, asignados o de backoffice" ON public.tickets
FOR SELECT TO authenticated USING (
  creado_por = auth.uid() OR asignado_a = auth.uid()
  OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_staff')
);
CREATE POLICY "Cualquiera abre un ticket" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (creado_por = auth.uid());
CREATE POLICY "Backoffice gestiona tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_staff'));

CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  presupuesto numeric,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanas TO authenticated;
GRANT ALL ON public.campanas TO service_role;
ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campanas visibles para el equipo" ON public.campanas
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Backoffice gestiona campanas" ON public.campanas
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_staff')
  OR public.has_role(auth.uid(), 'account_manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_staff')
  OR public.has_role(auth.uid(), 'account_manager')
);

-- Habilita Realtime (tickets y leads) para las métricas en vivo del
-- Backoffice: la app se suscribe a los cambios en vez de hacer polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
