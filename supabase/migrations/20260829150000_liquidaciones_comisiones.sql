-- Liquidaciones de comisiones: se apoya directamente en Facturación. Cuando
-- una factura pasa a "Pagada" se genera automáticamente una comisión
-- pendiente para el comercial; admin la aprueba, agrupa las aprobadas de un
-- comercial en una liquidación, y confirma el pago.

ALTER TABLE public.configuracion
  ADD COLUMN comision_porcentaje_defecto numeric NOT NULL DEFAULT 10;

CREATE TYPE public.estado_liquidacion AS ENUM ('Pendiente', 'Pagada', 'Cancelada');

CREATE TABLE public.liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  importe_total numeric NOT NULL,
  estado public.estado_liquidacion NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  pagada_at timestamptz
);
GRANT SELECT, UPDATE ON public.liquidaciones TO authenticated;
GRANT ALL ON public.liquidaciones TO service_role;
ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver liquidaciones propias o admin" ON public.liquidaciones
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestiona liquidaciones" ON public.liquidaciones
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TYPE public.estado_comision AS ENUM ('Pendiente', 'Aprobada', 'Liquidada', 'Cancelada');

CREATE TABLE public.comisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturacion(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  importe numeric NOT NULL,
  porcentaje numeric NOT NULL,
  estado public.estado_comision NOT NULL DEFAULT 'Pendiente',
  liquidacion_id uuid REFERENCES public.liquidaciones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (factura_id)
);
-- Sin INSERT para authenticated a propósito: las comisiones solo las crea el
-- trigger de facturación (como definer, evita el RLS), nunca el cliente
-- directamente, para que nadie pueda fabricarse una comisión.
GRANT SELECT, UPDATE ON public.comisiones TO authenticated;
GRANT ALL ON public.comisiones TO service_role;
ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver comisiones propias o admin" ON public.comisiones
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin aprueba comisiones" ON public.comisiones
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Genera la comisión al marcar una factura como pagada (idempotente: una
-- comisión por factura gracias al UNIQUE(factura_id)).
CREATE OR REPLACE FUNCTION public.generar_comision_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_porcentaje numeric;
BEGIN
  IF NEW.estado = 'Pagada' AND OLD.estado IS DISTINCT FROM 'Pagada' THEN
    SELECT comision_porcentaje_defecto INTO v_porcentaje FROM public.configuracion WHERE id = true;
    v_porcentaje := COALESCE(v_porcentaje, 10);
    INSERT INTO public.comisiones (factura_id, user_id, concepto, importe, porcentaje)
    VALUES (NEW.id, NEW.user_id, NEW.concepto, ROUND(NEW.importe * v_porcentaje / 100, 2), v_porcentaje)
    ON CONFLICT (factura_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.generar_comision_factura() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_generar_comision_factura
AFTER UPDATE ON public.facturacion
FOR EACH ROW EXECUTE FUNCTION public.generar_comision_factura();

-- Agrupa todas las comisiones "Aprobada" y sin liquidar de un comercial en
-- una liquidación nueva. Solo admin; transacción atómica (todo o nada).
CREATE OR REPLACE FUNCTION public.crear_liquidacion(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liquidacion_id uuid;
  v_total numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo administracion puede crear liquidaciones';
  END IF;

  SELECT COALESCE(SUM(importe), 0) INTO v_total
  FROM public.comisiones
  WHERE user_id = p_user_id AND estado = 'Aprobada' AND liquidacion_id IS NULL;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'No hay comisiones aprobadas pendientes de liquidar para este comercial';
  END IF;

  INSERT INTO public.liquidaciones (user_id, importe_total)
  VALUES (p_user_id, v_total)
  RETURNING id INTO v_liquidacion_id;

  UPDATE public.comisiones
  SET estado = 'Liquidada', liquidacion_id = v_liquidacion_id
  WHERE user_id = p_user_id AND estado = 'Aprobada' AND liquidacion_id IS NULL;

  RETURN v_liquidacion_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_liquidacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_liquidacion(uuid) TO authenticated;
