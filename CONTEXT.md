# VentaTalk — CONTEXT para Claude Code

> Este documento es para que Claude Code entienda el proyecto antes de tocar cualquier archivo.
> Leer completo antes de hacer cualquier cambio.

---

## Estructura del Monorepo (`ventatalk/`)

```
backend/
  app/
    api/v1/endpoints/    ← todos los routers FastAPI
    core/                ← config, database, security, rate_limit, plan_limits, encryption
    models/models.py     ← TODOS los modelos SQLAlchemy en un solo archivo
    services/            ← lógica de negocio (ai_service, message_processor, integrations/)
    workers/             ← Celery tasks (followup_tasks.py, billing_tasks.py, celery_app.py)
  migrations/versions/   ← migraciones Alembic
frontend/
  app/                   ← Next.js App Router
    auth/login/
    dashboard/           ← layout.tsx + secciones
  components/
  lib/api.ts             ← cliente axios con interceptores JWT
scripts/
  wordpress-plugin/ventatalk/  ← plugin WordPress
```

---

## Patrones de Código Backend

### Sesión de DB
```python
# SIEMPRE usar AsyncSession
from app.core.database import get_db, AsyncSessionLocal

# En endpoints (inyectado):
async def mi_endpoint(db: AsyncSession = Depends(get_db)):
    ...

# En background tasks (context manager):
async def mi_task():
    async with AsyncSessionLocal() as db:
        ...
```

### Queries
```python
# Patrón estándar
from sqlalchemy import select
result = await db.execute(select(Business).where(Business.id == business_id))
business = result.scalar_one_or_none()
```

### Enums en SQLAlchemy — MUY IMPORTANTE
```python
# SIEMPRE usar values_callable para evitar el bug de asyncpg con casing
plan: Mapped[PlanType] = mapped_column(
    Enum(PlanType, name="plan_type", values_callable=lambda x: [e.value for e in x]),
    default=PlanType.STARTER
)
# Sin esto, los enums fallan en producción con asyncpg
```

### JSONB con flag_modified
```python
# Al modificar campos JSONB, SIEMPRE marcar como modificado
from sqlalchemy.orm.attributes import flag_modified
business.integrations["jumpseller"] = {...}
flag_modified(business, "integrations")
await db.commit()
```

### Background Tasks
```python
# Las Celery tasks son sync y llaman asyncio.run() — ver followup_tasks.py como patrón
def mi_task():
    asyncio.run(_mi_task_async())

async def _mi_task_async():
    async with AsyncSessionLocal() as db:
        ...
```

### Encriptación de tokens
```python
from app.core.encryption import encrypt_token, decrypt_token, mask_token
# Guardar siempre encriptado
token_enc = encrypt_token(plain_token)
# Desencriptar solo en background tasks, nunca en responses
plain = decrypt_token(token_enc)
# Mostrar en UI solo como hint
hint = mask_token(token_enc)  # → "...xxxx"
```

---

## Patrones de Código Frontend

### Cliente API (`lib/api.ts`)
```typescript
// baseURL = NEXT_PUBLIC_API_URL + "/api/v1"
// Interceptor inyecta Bearer token desde localStorage
// Retry automático con refresh token en 401
// Al fallar refresh → redirige a /auth/login
import api, { conversationsApi, contactsApi } from "@/lib/api";
```

### Autenticación
```typescript
// Tokens en localStorage: "access_token", "refresh_token"
// Para admin: también cookie "admin_token" (necesaria para middleware Next.js)
```

### Next.js App Router
```typescript
// Rutas protegidas → middleware.ts en root del proyecto
// "use client" para componentes con estado/efectos
// Layout compartido en app/dashboard/layout.tsx
```

---

## Variables de Entorno

### Lo que usa el backend
```
APP_ENV=production              # development | production
APP_URL=https://app.ventatalk.com
API_URL=https://api.ventatalk.com
SUPERADMIN_EMAIL=admin@ventatalk.com
DATABASE_URL=postgresql+asyncpg://...
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MAX=price_...
```

### Lo que usa el frontend
```
NEXT_PUBLIC_API_URL=https://api.ventatalk.com  # build time ARG en Dockerfile
NEXT_PUBLIC_APP_NAME=VentaTalk
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

---

## Errores Conocidos y Sus Fixes

### 1. asyncpg enum casing bug
**Síntoma:** `LookupError: 'value' is not among the defined enum values`
**Fix:** Agregar `values_callable=lambda x: [e.value for e in x]` a TODOS los `Enum()` en SQLAlchemy

### 2. JSONB no se persiste
**Síntoma:** Cambios en campos JSONB no se guardan en DB
**Fix:** Llamar `flag_modified(objeto, "campo_jsonb")` antes del commit

### 3. CORS bloqueado
**Síntoma:** `No 'Access-Control-Allow-Origin' header`
**Causa real:** Casi siempre es un error 500 o 429 en el backend, no CORS
**Debug:** `curl -v -X OPTIONS https://api.ventatalk.com/endpoint -H "Origin: https://app.ventatalk.com"`

### 4. Rate limiter bloqueando OPTIONS
**Síntoma:** Login falla con CORS en producción
**Fix:** El middleware de rate limiting debe skipear requests con método OPTIONS:
```python
if request.method == "OPTIONS":
    return await call_next(request)
```

### 5. Next.js NEXT_PUBLIC_ en Docker
**Síntoma:** Variable aparece vacía en producción
**Causa:** `NEXT_PUBLIC_*` se embebe en build time, no runtime
**Fix:** Pasar como `ARG` en Dockerfile y build arg en docker-compose:
```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
```
```yaml
build:
  args:
    NEXT_PUBLIC_API_URL: https://api.ventatalk.com
```

### 6. Docker caché no invalida
**Síntoma:** Cambios de código no aparecen en producción
**Fix:** `docker compose build --no-cache` o forzar cambio en requirements.txt/package.json

### 7. git pull falla en deploy
**Síntoma:** `error: Your local changes would be overwritten by merge`
**Fix:** El workflow de GitHub Actions usa `git stash` antes del pull
**Fix adicional:** `chown -R hanowar:hanowar /home/hanowar/REPO/.git`

### 8. Frontend cae (OOM)
**Síntoma:** 502 Bad Gateway en app.ventatalk.com
**Causa:** Next.js supera el mem_limit de Docker
**Fix aplicado:** mem_limit: 1.5g + swap 2GB en VPS
**Diagnóstico:** `dmesg | grep -i "oom\|kill"` (como root en VPS)

### 9. Enum renombrado en DB
**Síntoma:** `LookupError: 'business' is not among the defined enum values`
**Causa:** Se renombró PlanType.BUSINESS → MAX pero la DB tenía valor viejo
**Fix:** `ALTER TYPE plan_type RENAME VALUE 'business' TO 'max'` en psql

---

## Comandos Útiles en el VPS

```bash
# Ver logs del API
docker compose -f docker-compose.prod.yml logs api --tail=50

# Rebuild sin caché
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d api

# Correr migración manualmente
docker compose -f docker-compose.prod.yml exec api alembic upgrade head

# Generar migración
docker compose -f docker-compose.prod.yml exec api alembic revision --autogenerate -m "descripcion"

# Acceder a psql
docker compose -f docker-compose.prod.yml exec db psql -U ventatalk -d ventatalk

# Verificar variable de entorno en contenedor
docker compose -f docker-compose.prod.yml exec api python3 -c "from app.core.config import get_settings; print(get_settings().APP_ENV)"

# Ver OOM killer
dmesg | grep -i "oom\|kill\|memory"
```

---

## Reglas de Negocio Importantes

### Conversaciones
- Una "conversación" = hilo completo con un cliente (no mensajes individuales)
- El contador `conversations_this_month` se incrementa al crear una conversación NUEVA
- Se resetea el día 1 de cada mes a las 00:05 UTC (Celery beat)
- Si supera el límite del plan → no responde con IA, notifica al owner

### Features por plan
- Al crear un Business → se asignan features del plan Starter automáticamente
- Al cambiar de plan (webhook Stripe) → se recalculan features preservando add-ons activos
- Los add-ons (instagram, mercadolibre, etc.) se activan por separado
- Ver `PLAN_FEATURES` en `backend/app/core/plan_limits.py`

### Superadmin
- Se autentica igual que cualquier Business (mismo endpoint `/api/v1/auth/login`)
- El rol se determina comparando `business.email == settings.SUPERADMIN_EMAIL`
- `SUPERADMIN_EMAIL` en `.env.production` del VPS

### WhatsApp outbound
- Meta SOLO permite outbound con templates pre-aprobados
- No enviar mensajes libres outbound — violaría políticas de Meta

### Tokens de integración
- NUNCA guardar en texto plano — siempre Fernet encrypt
- En UI mostrar solo los últimos 4-8 chars como hint
- Desencriptar SOLO en background tasks para llamadas a APIs externas

---

## Clientes Piloto

| Cliente | Integración | Estado |
|---|---|---|
| Clínica cosmética | WordPress | Plugin instalado |
| Repuestos automotriz | WordPress | Plugin instalado |
| Pace Coffee Roasters | Jumpseller | 15 productos synced |
