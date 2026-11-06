#!/usr/bin/env bash
# Tras subir una versión nueva del proyecto (o cambiar .env): copia de
# seguridad, nueva imagen de la plataforma y scripts SQL nuevos.
# Uso:  sudo bash actualizar.sh
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"
[ -f .env ] || falla "Primero instala:  sudo bash instalar.sh"

bash "$AQUI/copia-seguridad.sh"
info "Reconstruyendo la plataforma…"
dc up -d --build --remove-orphans
esperar_servicios
aplicar_sql
docker image prune -f >/dev/null
ok "Actualizado: $(grep '^URL_PUBLICA=' .env | cut -d= -f2-)"
