-- Solo para las pruebas locales (NO se ejecuta en Supabase): registro abierto y
-- sin límites de plan, para que las demás baterías puedan crear agencias.
update public.plataforma_ajustes set registro_abierto = true, dias_prueba = 0, plan_defecto = null;
update public.agencias set plan_id = null;
