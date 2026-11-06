-- Contraseñas de los usuarios internos de Supabase (= POSTGRES_PASSWORD).
-- Solo los que existen en esta versión de la imagen.
\set pgpass `echo "$POSTGRES_PASSWORD"`
select format('alter user %I with password %L', rolname, :'pgpass')
from pg_roles
where rolname in ('authenticator', 'pgbouncer', 'supabase_auth_admin', 'supabase_functions_admin', 'supabase_storage_admin')
\gexec
