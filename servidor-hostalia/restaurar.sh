#!/usr/bin/env bash
# Restaura una copia hecha con copia-seguridad.sh. BORRA los datos actuales.
# Uso:  sudo bash restaurar.sh copias/metatok-AAAAMMDD-HHMMSS.tar
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

COPIA="${1:-}"
[ -f "$COPIA" ] || falla "Indica el archivo de copia, p. ej.:  sudo bash restaurar.sh copias/metatok-20260101-033000.tar"
TMP=$(mktemp -d); trap 'rm -rf -- "$TMP"' EXIT
tar -C "$TMP" -xf "$COPIA"
[ -f "$TMP/base-datos.sql.gz" ] && [ -f "$TMP/archivos.tar.gz" ] || falla "El archivo no parece una copia de Metatok."

if [ -t 0 ]; then
  read -r -p "Se borrarán los datos actuales y se pondrán los de la copia. Escribe RESTAURAR para seguir: " r
  [ "$r" = "RESTAURAR" ] || falla "Cancelado."
fi
# La copia trae sus propias claves: sin ellas las sesiones y claves guardadas no valen.
cp "$TMP/env" "$AQUI/.env"; chmod 600 "$AQUI/.env"

info "Parando servicios y vaciando la base de datos…"
dc down
docker volume rm -f metatok_datos-db metatok_datos-archivos >/dev/null
dc up -d db
for _ in $(seq 1 60); do dc exec -T db pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done
sleep 5

info "Cargando la base de datos…"
gunzip -c "$TMP/base-datos.sql.gz" | dc exec -T db psql -q -U supabase_admin -d postgres > "$TMP/restaurar.log" 2>&1 || true
grep -E '^ERROR' "$TMP/restaurar.log" | grep -vE 'already exists|cannot drop|current user cannot be dropped|must be (owner|superuser)|reserved role|permission denied to (alter|drop|create) role' | head -5 || true

info "Cargando los archivos…"
dc up -d
dc exec -T storage sh -c 'tar -C /var/lib/storage -xzf -' < "$TMP/archivos.tar.gz"
esperar_servicios
psql_db -qc "notify pgrst, 'reload schema'" >/dev/null
ok "Copia restaurada."
