#!/usr/bin/env bash
# Funciones compartidas por instalar.sh, actualizar.sh y restaurar.sh.
set -euo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$AQUI/../NO-SUBIR-supabase"
cd "$AQUI"

dc() { docker compose --env-file "$AQUI/.env" -f "$AQUI/docker-compose.yml" ${METATOK_COMPOSE_EXTRA:+-f "$METATOK_COMPOSE_EXTRA"} "$@"; }
psql_db() { dc exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }
info() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
falla() { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

# Espera a que la base de datos y las migraciones de Auth y Storage estén listas.
esperar_servicios() {
  info "Esperando a la base de datos y a los servicios…"
  for _ in $(seq 1 120); do
    if psql_db -tAc "select exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous')
      and exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types')" 2>/dev/null | grep -q t; then
      ok "Base de datos lista"; return 0
    fi
    sleep 3
  done
  falla "La base de datos no arrancó a tiempo. Mira: docker compose logs db auth storage"
}

# Ejecuta, en orden, los scripts 09-… que aún no se han aplicado o que han cambiado.
aplicar_sql() {
  psql_db -qc "create schema if not exists instalacion;
    create table if not exists instalacion.scripts (nombre text primary key, huella text not null, aplicado timestamptz not null default now());
    revoke all on schema instalacion from public, anon, authenticated;" >/dev/null
  local n=0
  for f in $(ls "$SQL_DIR" | grep -E '^(09|[1-9][0-9])-.*\.sql$' | sort); do
    local huella; huella=$(sha256sum "$SQL_DIR/$f" | cut -c1-64)
    if [ "$(psql_db -tAc "select huella from instalacion.scripts where nombre = '$f'")" = "$huella" ]; then continue; fi
    info "Aplicando $f"
    # Como en el editor SQL de Supabase: el usuario «postgres».
    if ! dc exec -T db psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$SQL_DIR/$f" > /tmp/metatok-sql.log 2>&1; then
      cat /tmp/metatok-sql.log >&2; falla "Error en $f (arriba el detalle)"
    fi
    psql_db -qc "insert into instalacion.scripts (nombre, huella) values ('$f', '$huella')
      on conflict (nombre) do update set huella = excluded.huella, aplicado = now()" >/dev/null
    n=$((n + 1))
  done
  psql_db -qc "notify pgrst, 'reload schema'" >/dev/null
  ok "Base de datos al día ($n script(s) aplicados)"
}
