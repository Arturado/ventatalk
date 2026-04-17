# VentaBot — Vendedor IA para WhatsApp + CRM

SaaS B2B para PYMEs chilenas. IA entrenada con el catálogo del negocio responde WhatsApp, gestiona leads y envía follow-ups automáticos.

## Requisitos

- Docker + Docker Compose
- Cuenta OpenAI (API key)
- Cuenta Meta for Developers (para WhatsApp Cloud API)

## Arranque rápido

```bash
git clone <repo>
cd ventabot
./start.sh
```

El script te guía si falta el `.env`.

## Variables de entorno clave

| Variable | Dónde conseguirla |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com |
| `META_VERIFY_TOKEN` | Invéntala tú (string random) |
| `META_APP_SECRET` | Meta for Developers → tu App → Settings |
| `SECRET_KEY` | `openssl rand -hex 32` |

## URLs locales

| Servicio | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |

## Estructura

```
ventabot/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # Todos los endpoints REST
│   │   ├── core/               # Config, DB, Auth
│   │   ├── models/             # SQLAlchemy + pgvector
│   │   ├── services/           # AI service, WhatsApp service
│   │   └── workers/            # Celery (follow-ups)
│   └── migrations/             # Alembic
├── frontend/
│   └── app/
│       ├── dashboard/          # Overview, conversations, leads, contacts, settings
│       └── auth/               # Login, register
├── docker-compose.yml
└── start.sh
```

## Configurar webhook de Meta

1. En tu servidor público (o ngrok para desarrollo):
   ```bash
   ngrok http 8000
   ```
2. En Meta for Developers → tu App → WhatsApp → Configuration:
   - Webhook URL: `https://TU_NGROK/webhook`
   - Verify Token: el mismo que pusiste en `META_VERIFY_TOKEN`
3. Suscribirse a: `messages`, `message_deliveries`, `message_reads`

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f api worker

# Correr migraciones manualmente
docker compose exec api alembic upgrade head

# Crear nueva migración
docker compose exec api alembic revision --autogenerate -m "descripcion"

# Entrar a la DB
docker compose exec db psql -U ventabot -d ventabot_db

# Reiniciar solo el API (sin reconstruir)
docker compose restart api
```
