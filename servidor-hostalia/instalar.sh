#!/usr/bin/env bash
# Instalación completa de Metatok en un VPS limpio (Ubuntu 22.04/24.04 o Debian 12).
# Uso:  sudo bash instalar.sh
# Se puede volver a ejecutar: no toca los datos ni las claves ya creadas.
source "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

[ "$(id -u)" -eq 0 ] || falla "Ejecútalo como root:  sudo bash instalar.sh"

# 1 · Docker ----------------------------------------------------------------------
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  info "Instalando Docker…"
  command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

# Cortafuegos: solo SSH, HTTP y HTTPS (la base de datos no se expone nunca).
if command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null && ok "Cortafuegos: 22, 80 y 443 abiertos"
fi

# 2 · Configuración (.env) ----------------------------------------------------------
pregunta() { # variable, texto, valor por defecto
  local actual="${!1:-}"
  if [ -n "$actual" ]; then return; fi
  if [ -t 0 ]; then read -r -p "$2${3:+ [$3]}: " actual; fi
  printf -v "$1" '%s' "${actual:-${3:-}}"
}
aleatorio() { openssl rand -hex "$1"; }
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # rol, secreto
  local ahora; ahora=$(date +%s)
  local c; c=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  local p; p=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$ahora" $((ahora + 315360000)) | b64url)
  printf '%s.%s.%s' "$c" "$p" "$(printf '%s.%s' "$c" "$p" | openssl dgst -sha256 -hmac "$2" -binary | b64url)"
}

if [ ! -f .env ]; then
  echo
  echo "Configuración inicial (puedes cambiarla luego en servidor-hostalia/.env)"
  pregunta DOMINIO "Dominio de la plataforma (p. ej. app.tuempresa.com)" ""
  [ -n "$DOMINIO" ] || falla "Hace falta un dominio que apunte a la IP de este servidor."
  pregunta CORREO_ADMIN "Tu correo (primer superadministrador y avisos del certificado)" ""
  [[ "$CORREO_ADMIN" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || falla "Correo no válido."
  pregunta PROTOCOLO "Protocolo (https en producción)" "https"
  pregunta SMTP_HOST "Servidor SMTP para los correos de acceso (en Hostalia: el de tu buzón; vacío = más tarde)" ""
  if [ -n "$SMTP_HOST" ]; then
    pregunta SMTP_PORT "Puerto SMTP" "587"
    pregunta SMTP_USUARIO "Usuario SMTP (el buzón completo)" ""
    pregunta SMTP_CLAVE "Contraseña SMTP" ""
    pregunta SMTP_REMITENTE "Remitente de los correos" "$SMTP_USUARIO"
  fi
  pregunta ANTHROPIC_API_KEY "Clave de la IA (ANTHROPIC_API_KEY; vacío = más tarde)" ""

  JWT_SECRET=$(aleatorio 40)
  SITIO="$DOMINIO"; [ "$PROTOCOLO" = "https" ] || SITIO="$PROTOCOLO://$DOMINIO"
  umask 077
  cat > .env <<FIN
# --- Metatok · configuración del servidor (no compartir: contiene claves) ---
DOMINIO=$DOMINIO
URL_PUBLICA=$PROTOCOLO://$DOMINIO
SITIO=$SITIO
CORREO_AVISOS=$CORREO_ADMIN
CORREO_ADMIN=$CORREO_ADMIN

# Claves internas (generadas al instalar; si cambias JWT_SECRET hay que regenerar ANON_KEY y SERVICE_ROLE_KEY)
POSTGRES_PASSWORD=$(aleatorio 24)
JWT_SECRET=$JWT_SECRET
ANON_KEY=$(jwt anon "$JWT_SECRET")
SERVICE_ROLE_KEY=$(jwt service_role "$JWT_SECRET")
CRON_SECRET=$(aleatorio 24)
REALTIME_SECRETO=$(aleatorio 32)
SAML_CLAVE_PRIVADA=$(openssl genrsa 2048 2>/dev/null | openssl rsa -traditional -outform DER 2>/dev/null | base64 -w0)

# Correo de acceso (invitaciones, recuperar contraseña)
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USUARIO=${SMTP_USUARIO:-}
SMTP_CLAVE=${SMTP_CLAVE:-}
SMTP_REMITENTE=${SMTP_REMITENTE:-}
SMTP_NOMBRE=Metatok
# true solo para pruebas sin correo: confirma las cuentas sin enviar nada
CORREO_AUTOCONFIRMAR=${CORREO_AUTOCONFIRMAR:-false}

# Inteligencia artificial
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
IA_PROVEEDOR_PAGINAS=claude

# Pagos con Stripe (opcional)
STRIPE_WEBHOOK_SECRET=

# Inicio de sesión con Google / Microsoft (opcional)
GOOGLE_ACTIVO=false
GOOGLE_CLIENTE_ID=
GOOGLE_SECRETO=
MICROSOFT_ACTIVO=false
MICROSOFT_CLIENTE_ID=
MICROSOFT_SECRETO=
FIN
  chmod 600 .env
  ok "Configuración guardada en servidor-hostalia/.env"
fi
set -a; source .env; set +a

# 3 · Arranque ------------------------------------------------------------------------
info "Construyendo la plataforma y arrancando los servicios (la primera vez tarda unos minutos)…"
dc up -d --build
esperar_servicios

# 4 · Base de datos -------------------------------------------------------------------
aplicar_sql

# 5 · Primer superadministrador -------------------------------------------------------
if [ "$(psql_db -tAc 'select count(*) from public.plataforma_admins')" = "0" ]; then
  info "Creando el superadministrador $CORREO_ADMIN"
  CLAVE_ADMIN="Mt-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  dc exec -T -e CORREO="$CORREO_ADMIN" -e CLAVE="$CLAVE_ADMIN" app node -e '
    fetch("http://auth:9999/admin/users", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify({ email: process.env.CORREO, password: process.env.CLAVE, email_confirm: true }) })
    .then(async (r) => { const t = await r.text(); if (!r.ok && !/already|registered|exists/i.test(t)) { console.error(t); process.exit(1); } })
    .catch((e) => { console.error(e.message); process.exit(1); });' || falla "No se pudo crear el usuario administrador."
  psql_db -qtAc "select public.plataforma_alta_admin('$CORREO_ADMIN')" >/dev/null
  umask 077
  printf 'Superadministrador: %s\nContraseña inicial: %s\n(Cámbiala al entrar y borra este archivo.)\n' "$CORREO_ADMIN" "$CLAVE_ADMIN" > .acceso-inicial.txt
  ok "Superadministrador creado (contraseña en servidor-hostalia/.acceso-inicial.txt)"
fi

# 6 · Copias de seguridad diarias ------------------------------------------------------
if [ -d /etc/cron.d ]; then
  printf 'SHELL=/bin/bash\n30 3 * * * root bash %s/copia-seguridad.sh >> /var/log/metatok-copias.log 2>&1\n' "$AQUI" > /etc/cron.d/metatok-copias
  ok "Copia de seguridad diaria a las 03:30 (se guardan 14 días en servidor-hostalia/copias)"
fi

echo
ok "Instalación terminada"
echo "   Plataforma:  $URL_PUBLICA"
[ -f .acceso-inicial.txt ] && sed 's/^/   /' .acceso-inicial.txt
[ -z "${SMTP_HOST:-}" ] && echo "   Aviso: sin SMTP no salen invitaciones ni recuperaciones de contraseña (rellénalo en .env y ejecuta: bash actualizar.sh)."
[ -z "${ANTHROPIC_API_KEY:-}" ] && echo "   Aviso: sin ANTHROPIC_API_KEY no funcionan los asistentes ni la creación con IA."
exit 0
