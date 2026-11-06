-- =============================================================================
-- 33 · TAREAS PROGRAMADAS DESDE SUPABASE
-- Cada minuto, Supabase llama a la plataforma para enviar recordatorios,
-- avanzar automatizaciones, enviar campañas y contestar con la IA.
-- Sustituye al cron de Vercel (en su plan gratuito solo deja una vez al día).
-- Requiere el 32. Re-ejecutable.
--
-- Después de ejecutarlo, una vez, en el SQL Editor (con TU dominio y el mismo
-- CRON_SECRET que pusiste en Vercel):
--   select public.programar_tareas('https://metatok.labs24k.com', 'tu-CRON_SECRET');
-- Para comprobar que va:  select * from public.tareas_ultimas;
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Programa (o reprograma) la llamada de cada minuto. Solo desde el SQL Editor.
create or replace function public.programar_tareas(p_url text, p_secreto text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_url text := rtrim(trim(coalesce(p_url, '')), '/');
begin
  if v_url !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' then
    raise exception 'Pon la dirección de la plataforma con https, sin barra final (p. ej. https://metatok.labs24k.com).' using errcode = 'check_violation';
  end if;
  if length(coalesce(p_secreto, '')) < 16 then
    raise exception 'El CRON_SECRET tiene que tener al menos 16 caracteres (el mismo que en Vercel).' using errcode = 'check_violation';
  end if;
  -- La programación antigua del README (cada 5 minutos) deja paso a esta.
  perform cron.unschedule(jobid) from cron.job where jobname = 'recordatorios-citas';
  perform cron.schedule('metatok-tareas', '* * * * *', format(
    $c$select net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L), timeout_milliseconds := 55000)$c$,
    v_url || '/api/cron/recordatorios', 'Bearer ' || p_secreto));
  -- Limpieza semanal del historial de llamadas.
  perform cron.schedule('metatok-limpieza', '17 4 * * 0',
    $c$delete from cron.job_run_details where end_time < now() - interval '7 days'$c$);
  return 'Programado: cada minuto se llamará a ' || v_url || '/api/cron/recordatorios';
end $$;
revoke all on function public.programar_tareas(text, text) from public, anon, authenticated;

-- Últimas respuestas de la plataforma (para comprobar que funciona).
create or replace view public.tareas_ultimas with (security_invoker = true) as
  select r.created as hora, r.status_code as codigo, left(r.content, 300) as respuesta, r.error_msg as error
  from net._http_response r
  order by r.created desc
  limit 20;
revoke all on public.tareas_ultimas from public, anon, authenticated;
