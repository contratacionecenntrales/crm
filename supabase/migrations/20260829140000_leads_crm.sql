-- CRM de leads: pipeline de captación antes de convertirse en cliente
-- (citas/facturación). Cada comercial ve solo sus leads asignados; admin ve
-- y reasigna todos.
CREATE TYPE public.estado_lead AS ENUM (
  'Nuevo',
  'Contactado',
  'Cita agendada',
  'Ganado',
  'Descartado'
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  contacto text,
  telefono text,
  email text,
  ciudad text,
  sector text,
  campana text,
  notas text,
  estado public.estado_lead NOT NULL DEFAULT 'Nuevo',
  asignado_a uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver leads propios o admin" ON public.leads
FOR SELECT TO authenticated
USING (asignado_a = auth.uid() OR creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Crear leads" ON public.leads
FOR INSERT TO authenticated WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Editar leads propios o admin" ON public.leads
FOR UPDATE TO authenticated
USING (asignado_a = auth.uid() OR creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (asignado_a = auth.uid() OR creado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Borrar leads solo admin" ON public.leads
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Solo admin puede reasignar un lead a otro comercial; un comercial normal
-- solo puede tocar el resto de campos de sus propios leads.
CREATE OR REPLACE FUNCTION public.proteger_asignacion_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.asignado_a IS DISTINCT FROM OLD.asignado_a AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo administracion puede reasignar un lead';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_asignacion_lead() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_proteger_asignacion_lead
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.proteger_asignacion_lead();
