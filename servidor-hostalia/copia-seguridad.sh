#!/usr/bin/env bash
# Copia completa: base de datos (todo, incluidos usuarios), archivos subidos y
# configuración. Se guardan 14 días en servidor-hostalia/copias.
# Uso:  sudo bash copia-seguridad.sh
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

DESTINO="$AQUI/copias"; mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
SELLO=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d); trap 'rm -rf -- "$TMP"' EXIT

info "Volcando la base de datos…"
dc exec -T db pg_dumpall -U supabase_admin --clean --if-exists | gzip -6 > "$TMP/base-datos.sql.gz"
info "Copiando los archivos subidos…"
dc exec -T storage tar -C /var/lib/storage -czf - . > "$TMP/archivos.tar.gz"
cp "$AQUI/.env" "$TMP/env"
tar -C "$TMP" -cf "$DESTINO/metatok-$SELLO.tar" base-datos.sql.gz archivos.tar.gz env
chmod 600 "$DESTINO/metatok-$SELLO.tar"
find "$DESTINO" -name 'metatok-*.tar' -mtime +14 -delete
ok "Copia guardada: $DESTINO/metatok-$SELLO.tar ($(du -h "$DESTINO/metatok-$SELLO.tar" | cut -f1))"
