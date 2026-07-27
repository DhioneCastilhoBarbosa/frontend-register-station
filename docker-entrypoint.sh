#!/bin/sh
set -eu

# Escapa valor para string JS entre aspas duplas
js_escape() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e ':a;N;$!ba;s/\n/\\n/g'
}

# Aceita VITE_* (padrão) ou nomes sem prefixo (alguns painéis)
API_URL="${VITE_API_URL:-${API_URL:-https://api-register.api-castilho.com.br}}"
AUTH_EMAIL="${VITE_AUTH_EMAIL:-${AUTH_EMAIL:-}}"
AUTH_PASSWORD="${VITE_AUTH_PASSWORD:-${AUTH_PASSWORD:-}}"
LICENSE_CODE="${VITE_LICENSE_CODE:-${LICENSE_CODE:-}}"

API_URL_ESC=$(js_escape "$API_URL")
EMAIL_ESC=$(js_escape "$AUTH_EMAIL")
PASS_ESC=$(js_escape "$AUTH_PASSWORD")
LICENSE_ESC=$(js_escape "$LICENSE_CODE")

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_URL: "${API_URL_ESC}",
  VITE_AUTH_EMAIL: "${EMAIL_ESC}",
  VITE_AUTH_PASSWORD: "${PASS_ESC}",
  VITE_LICENSE_CODE: "${LICENSE_ESC}"
};
EOF

echo "[config] API_URL=${API_URL}"
echo "[config] AUTH_EMAIL set=$([ -n "$AUTH_EMAIL" ] && echo yes || echo NO)"
echo "[config] AUTH_PASSWORD set=$([ -n "$AUTH_PASSWORD" ] && echo yes || echo NO)"
echo "[config] LICENSE_CODE set=$([ -n "$LICENSE_CODE" ] && echo yes || echo NO)"

exec nginx -g "daemon off;"
