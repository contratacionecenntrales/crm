-- =============================================================================
-- 15 · INICIO DE SESIÓN ÚNICO (SSO) DE LA AGENCIA
--
-- Requiere 09 y 11. Idempotente.
--
--   · Cada agencia asocia uno o varios dominios de correo (empresa.com) a un
--     proveedor: SAML (Okta, Azure AD, Google Workspace…), Google o Microsoft.
--   · «Obligatorio»: quien tenga un correo de esos dominios no puede entrar
--     con contraseña. Lo hace cumplir el «Custom Access Token Hook» de
--     Supabase (sso_hook_token), así que no se puede saltar desde fuera de
--     la aplicación.
--   · «Alta automática»: la primera vez que alguien entra por SSO con un
--     correo de esos dominios, se le añade a la agencia como «usuario».
-- =============================================================================

alter table public.agencias
  add column if not exists sso_activo boolean not null default false,
  add column if not exists sso_proveedor text not null default 'saml',
  add column if not exists sso_obligatorio boolean not null default false,
  add column if not exists sso_autoalta boolean not null default false;
do $$ begin
  alter table public.agencias add constraint agencias_sso_proveedor_check check (sso_proveedor in ('saml', 'google', 'azure'));
exception when duplicate_object then null; end $$;

-- Un dominio solo puede pertenecer a una agencia.
create table if not exists public.sso_dominios (
  dominio    text primary key check (dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  creado     timestamptz not null default now()
);
create index if not exists sso_dominios_agencia_idx on public.sso_dominios(agencia_id);
alter table public.sso_dominios enable row level security;
revoke all on public.sso_dominios from anon, authenticated;
grant all on public.sso_dominios to service_role;
grant select on public.sso_dominios to authenticated;
drop policy if exists sso_dominios_lee on public.sso_dominios;
create policy sso_dominios_lee on public.sso_dominios for select to authenticated
  using (public.soy_admin_agencia(agencia_id));

-- Guarda la configuración (solo administradores de la agencia).
create or replace function public.sso_guardar(p_agencia uuid, p_activo boolean, p_proveedor text, p_dominios text[],
                                              p_obligatorio boolean, p_autoalta boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_dom text[];
  v_ocupado text;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede cambiar el SSO.' using errcode = 'insufficient_privilege';
  end if;
  if p_proveedor not in ('saml', 'google', 'azure') then
    raise exception 'Proveedor no válido.' using errcode = 'check_violation';
  end if;
  v_dom := coalesce((select array_agg(distinct lower(trim(d))) from unnest(p_dominios) d where trim(d) <> ''), '{}');
  if cardinality(v_dom) > 20 then
    raise exception 'Máximo 20 dominios.' using errcode = 'check_violation';
  end if;
  if p_activo and cardinality(v_dom) = 0 then
    raise exception 'Añade al menos un dominio para activar el SSO.' using errcode = 'check_violation';
  end if;
  select dominio into v_ocupado from public.sso_dominios where dominio = any(v_dom) and agencia_id <> p_agencia limit 1;
  if v_ocupado is not null then
    raise exception 'El dominio % ya lo usa otra agencia.', v_ocupado using errcode = 'unique_violation';
  end if;

  delete from public.sso_dominios where agencia_id = p_agencia and not (dominio = any(v_dom));
  insert into public.sso_dominios (dominio, agencia_id) select d, p_agencia from unnest(v_dom) d on conflict (dominio) do nothing;
  update public.agencias set sso_activo = p_activo, sso_proveedor = p_proveedor,
    sso_obligatorio = p_activo and p_obligatorio, sso_autoalta = p_autoalta
  where id = p_agencia;
end $$;

-- ¿Cómo entra este correo? (página de acceso, sin sesión). Solo revela el
-- tipo de proveedor de dominios con SSO activo, nunca a qué agencia van.
create or replace function public.sso_para_email(p_email text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('dominio', d.dominio, 'proveedor', a.sso_proveedor, 'obligatorio', a.sso_obligatorio)
  from public.sso_dominios d join public.agencias a on a.id = d.agencia_id
  where a.sso_activo and d.dominio = lower(split_part(trim(p_email), '@', 2));
$$;

-- Tras entrar por SSO: alta automática en la agencia si está activada.
-- Solo vale si la sesión se abrió de verdad por SSO u OAuth (claim «amr»).
create or replace function public.sso_unirse()
returns uuid language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_email text;
  v_agencia uuid;
  v_metodos text[];
begin
  if auth.uid() is null then return null; end if;
  select array_agg(m ->> 'method') into v_metodos from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m;
  if not (coalesce(v_metodos, '{}') && array['sso/saml', 'oauth']) then return null; end if;
  select email into v_email from auth.users where id = auth.uid();
  select a.id into v_agencia from public.sso_dominios d join public.agencias a on a.id = d.agencia_id
  where a.sso_activo and a.sso_autoalta and d.dominio = lower(split_part(v_email, '@', 2));
  if v_agencia is null then return null; end if;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_agencia, auth.uid(), 'usuario')
  on conflict do nothing;
  return v_agencia;
end $$;

-- Custom Access Token Hook: bloquea el acceso con contraseña (o enlace
-- mágico) a los correos de dominios con SSO obligatorio.
-- Actívalo en Supabase → Authentication → Hooks → Custom Access Token →
-- función public.sso_hook_token.
create or replace function public.sso_hook_token(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_email text;
  v_metodo text := event ->> 'authentication_method';
begin
  if v_metodo in ('password', 'otp', 'magiclink', 'email/signup', 'invite', 'recovery') then
    select email into v_email from auth.users where id = (event ->> 'user_id')::uuid;
    if exists (select 1 from public.sso_dominios d join public.agencias a on a.id = d.agencia_id
               where a.sso_activo and a.sso_obligatorio and d.dominio = lower(split_part(v_email, '@', 2))) then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403,
        'message', 'Tu empresa exige entrar con inicio de sesión único (SSO).'));
    end if;
  end if;
  return jsonb_build_object('claims', event -> 'claims');
end $$;

revoke all on function public.sso_guardar(uuid, boolean, text, text[], boolean, boolean) from public, anon;
revoke all on function public.sso_para_email(text) from public;
revoke all on function public.sso_unirse() from public, anon;
revoke all on function public.sso_hook_token(jsonb) from public, anon, authenticated;
grant execute on function public.sso_guardar(uuid, boolean, text, text[], boolean, boolean) to authenticated;
grant execute on function public.sso_para_email(text) to anon, authenticated;
grant execute on function public.sso_unirse() to authenticated;
do $$ begin
  grant execute on function public.sso_hook_token(jsonb) to supabase_auth_admin;
  grant select on public.sso_dominios, public.agencias to supabase_auth_admin;
exception when undefined_object then null; end $$;
