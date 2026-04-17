#!/bin/bash
# start.sh — Levanta VentaBot desde cero
# Uso: ./start.sh [dev|prod]

set -e
MODE=${1:-dev}
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
RESET="\033[0m"

log() { echo -e "${BLUE}[ventabot]${RESET} $1"; }
ok()  { echo -e "${GREEN}✓${RESET} $1"; }

# ── 1. Verificar .env ────────────────────────────────────────────────
if [ ! -f .env ]; then
  log "No existe .env — copiando desde .env.example..."
  cp .env.example .env
  echo ""
  echo -e "${BOLD}⚠️  Debes editar .env con tus claves antes de continuar:${RESET}"
  echo "   - OPENAI_API_KEY"
  echo "   - META_VERIFY_TOKEN (invéntalo tú, ej: mi-token-secreto-123)"
  echo "   - META_APP_SECRET (desde Meta for Developers)"
  echo "   - SECRET_KEY (ejecuta: openssl rand -hex 32)"
  echo ""
  echo "Luego vuelve a ejecutar: ./start.sh"
  exit 1
fi

log "Modo: ${MODE}"

# ── 2. Build y levanta contenedores ─────────────────────────────────
log "Levantando contenedores Docker..."
docker compose up -d --build

# ── 3. Esperar a que la DB esté lista ───────────────────────────────
log "Esperando que PostgreSQL esté listo..."
until docker compose exec -T db pg_isready -U ventabot -q; do
  sleep 1
done
ok "PostgreSQL listo"

# ── 4. Correr migraciones ────────────────────────────────────────────
log "Corriendo migraciones Alembic..."
docker compose exec -T api alembic upgrade head
ok "Migraciones aplicadas"

# ── 5. Seed opcional ────────────────────────────────────────────────
if [ "$2" == "--seed" ]; then
  log "Cargando datos de prueba..."
  docker compose exec -T api python scripts/seed.py
  ok "Seed completado"
fi

# ── 6. Status ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}✅ VentaBot levantado correctamente${RESET}"
echo ""
echo "  API:          http://localhost:8000"
echo "  Docs (Swagger): http://localhost:8000/docs"
echo "  Dashboard:    http://localhost:3000"
echo "  Health check: http://localhost:8000/health"
echo ""
echo "  Logs API:     docker compose logs -f api"
echo "  Logs Worker:  docker compose logs -f worker"
echo ""
