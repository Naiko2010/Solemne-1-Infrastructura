#!/bin/sh
set -e
# Volumen nombrado puede quedar a medias (p. ej. solo vite); npm ls valida el lockfile.
if [ ! -f /app/node_modules/.bin/vite ] || ! (cd /app && npm ls --depth=0 >/dev/null 2>&1); then
  echo "delivery-frontend-dev: instalando dependencias (primer arranque o node_modules incompleto)..."
  (cd /app && npm ci)
fi
# Con bind mount, caché vieja en node_modules/.vite provoca "Failed to resolve import" en imports nuevos.
rm -rf /app/node_modules/.vite 2>/dev/null || true
exec "$@"
