# VentaTalk — CONTEXT para Claude Code

> Leer completo antes de hacer cualquier cambio.
> Última actualización: Mayo 2026 (post-reconstrucción VPS + migración arturodev.info)

---

## Estructura del Monorepo

```
backend/
  Dockerfile                ← multi-stage, USER ventatalk (non-root)
  app/api/v1/endpoints/
    admin.py                ← superadmin (requiere SUPERADMIN_EMAIL)
    auth.py                 ← login, register, refresh, me
    billing.py              ← Stripe checkout, webhook, portal
    business.py             ← perfil, catálogo, órdenes, cupones, usage
    conversations.py, contacts.py, integrations.py
    tracking.py             ← conversion tokens
    webhook.py              ← WhatsApp inbound
  app/workers/              ← Celery worker + beat
  alembic/versions/         ← migraciones 001 → 008_catalog_product_url

frontend/
  Dockerfile                ← multi-stage Next.js standalone, USER node
  package.json              ← Next.js 15.5.18 (parchado tras CVE de 15.0.3)
  app/dashboard/
    page.tsx                ← overview
    conversations/page.tsx  ← layout estilo WhatsApp Web
    contacts/, leads/
    ecommerce/
      productos/page.tsx    ← tabla: thumbnail, SKU, stock, toggle is_available
      orders/page.tsx       ← tabla con filtros, paginación, modal detalle
      cupones/page.tsx      ← tabla con filtros, paginación, modal detalle
    integrations/, settings/
  components/dashboard/Sidebar.tsx
  components/ui/ThemeProvider.tsx  ← forzado light (enableSystem=false)
  lib/api.ts                ← baseURL = NEXT_PUBLIC_API_URL + "/api/v1"

docker-compose.yml          ← desarrollo local
docker-compose.prod.yml     ← producción VPS
  - api, worker, beat (backend, Python 3.12)
  - frontend (Next.js)
  - db (pgvector/pgvector:pg16)
  - redis (redis:7-alpine)
  - volumes: postgres_data, redis_data, celery_beat_data
.env.example                ← plantilla sin valores reales
.env.development            ← local (NO commitear)
.env.production             ← VPS (NO commitear)

scripts/wordpress-plugin/ventatalk/  ← v1.1.0
  ventatalk.php
  includes/settings.php
  public/js/widget.js
```

## Repos relacionados (fuera de este monorepo)

```
ventatalk-web/        ← landing ventatalk.com (Next 14.2.29, migrar a 15.x pendiente)
  Dockerfile          ← single-stage con `chown -R node:node /app` + USER node
  docker-compose.yml  ← env_file: .env.production
  .gitignore          ← incluye .env, .env.production, .env.development

ventatalk-admin/      ← panel superadmin admin.ventatalk.com (Next 16.2.6)
  Dockerfile          ← multi-stage standalone, USER node
  docker-compose.yml  ← NEXT_PUBLIC_API_URL hardcoded en build args
```

---

## Endpoints Backend — Referencia Completa

### Auth (/api/v1/auth/)
```
POST   /login                            OAuth2PasswordRequestForm (username=email)
POST   /register                         { name, email, password } → tokens + business creado
POST   /refresh
GET    /me
```

### Business (/api/v1/business/)
```
GET    /profile, PUT /profile
GET    /catalog                          → CatalogItem[] con image_url, stock_quantity, sku, product_url
POST   /catalog                          upload CSV
DELETE /catalog/source/{name}            elimina productos de esa fuente
PATCH  /catalog/{id}/toggle              activa/desactiva is_available
GET/POST /catalog/source                 fuente activa del catálogo
GET    /orders?page&limit&search&status&payment_method   paginado
GET    /coupons?page&limit&search&is_active              paginado
GET    /usage
```

### Integraciones (/api/v1/integrations/)
```
WooCommerce:
  POST   /woocommerce/token, GET /woocommerce/status, DELETE /woocommerce/token
  POST   /woocommerce/ingest          → productos (X-VentaTalk-Token)
  POST   /woocommerce/orders/ingest   → órdenes
  POST   /woocommerce/coupons/ingest  → cupones

Jumpseller (con auto-detect URL prefix):
  POST /jumpseller/connect, sync | GET /status | DELETE /disconnect
  Cache en business.integrations.jumpseller.{shop_url, url_prefix}

Bsale/Shopify/MercadoLibre:
  POST /{provider}/connect, sync | GET /status | DELETE /disconnect
```

### Admin (/api/v1/admin/) — requiere SUPERADMIN_EMAIL
```
GET    /stats/overview
GET    /businesses?page&search&limit     → { items: [...], total, page, pages, limit }
GET    /businesses/{id}                  → un item de la lista (sin enriquecimiento extra)
PATCH  /businesses/{id}/features         → toggle feature flags JSONB
PATCH  /businesses/{id}/plan             → cambiar plan starter/pro/max
```

### Tracking (/api/v1/)
```
POST /conversations/{id}/tracking-link
GET  /conversations/{id}/tracking-links
GET  /track/{token}                      público, redirige
```

### Billing (/api/v1/billing/)
```
POST /create-checkout-session
POST /webhook                            Stripe (firma con STRIPE_WEBHOOK_SECRET)
GET  /portal
```

---

## Modelos DB

### CatalogItem
```python
is_available: bool      # False = bot NO lee el producto
source: str             # csv|woocommerce|jumpseller|bsale|shopify|mercadolibre
product_url: str(500)?  # Tracking 2.0 — URL real del producto en la tienda
metadata: JSONB         # image_url, stock_quantity, sku (según fuente)
embedding: Vector(1536)
```

### Order
```python
business_id, source, external_id, order_number
status: str             # pending|processing|completed|cancelled|refunded|on-hold|failed
total, currency, payment_method
customer_name, customer_email, customer_phone
items: JSONB            # [{name, qty, price, sku}]
notes, ordered_at, synced_at
UniqueConstraint: (business_id, source, external_id)
```

### Coupon
```python
business_id, source, external_id, code
discount_type: str      # percent|fixed_cart|fixed_product
discount_value, min_order_amount
usage_count, usage_limit
expires_at, is_active, description
UniqueConstraint: (business_id, source, code)
```

### Business
```python
plan: PlanType          # starter|pro|max
billing_cycle           # monthly|annual
stripe_customer_id, stripe_subscription_id
features: JSONB         # Record<string, boolean> — feature flags por tenant. null por defecto.
conversations_this_month, conversations_reset_at
integrations: JSONB     # config de cada integración (tokens encriptados con Fernet)
```

### Conversation
```python
channel: str            # whatsapp|instagram
status: ConversationStatus
```

---

## lib/api.ts — Interfaces Clave

```typescript
interface CatalogItem {
  id, name, price?, is_available, source
  image_url?, stock_quantity?, sku?, product_url?
}

interface Order {
  id, order_number, status, total, currency
  payment_method?, customer_name?, customer_email?, customer_phone?
  items: OrderItem[], notes?, ordered_at?, source
}

interface Coupon {
  id, code, discount_type, discount_value
  description?, min_order_amount?, usage_count, usage_limit?
  expires_at?, is_active, source
}

businessApi.toggleCatalogItem(id, isAvailable)    // PATCH /business/catalog/{id}/toggle
businessApi.deleteCatalogSource(name)              // DELETE /business/catalog/source/{name}
businessApi.getCatalog()                           // GET /business/catalog
businessApi.getOrders(params)                      // GET /business/orders
businessApi.getCoupons(params)                     // GET /business/coupons
```

---

## Plugin WordPress (v1.1.0)

Funciones principales:
- `ventatalk_build_product_payload($id)` → payload de producto
- `ventatalk_build_order_payload($id)` → payload de orden
- `ventatalk_build_coupon_payload($id)` → payload de cupón
- `ventatalk_push_single_product($id)` → push individual
- `ventatalk_push_single_order($id)` → push individual
- `ventatalk_push_single_coupon($id)` → push individual

Hooks tiempo real:
- `woocommerce_update_product` → push producto
- `woocommerce_product_set_stock` → push producto
- `woocommerce_product_set_price` → push producto
- `woocommerce_new_order` → push orden
- `woocommerce_order_status_changed` → push orden
- `woocommerce_coupon_options_save` → push cupón

Payload producto incluye: name, price, description, category, image_url, stock_quantity, sku, is_available
Auth: Header `X-VentaTalk-Token`

---

## Patrones Backend

```python
# Enums — SIEMPRE values_callable
Enum(PlanType, name="plan_type", values_callable=lambda x: [e.value for e in x])

# JSONB — SIEMPRE flag_modified
from sqlalchemy.orm.attributes import flag_modified
business.integrations["key"] = {...}
flag_modified(business, "integrations")
await db.commit()

# Encriptación
from app.core.encryption import encrypt_token, decrypt_token, mask_token
# Guardar encriptado, desencriptar solo en background tasks
# UI: mask_token(enc) → "...xxxx"

# Paginación estándar (ver orders/coupons en business.py como referencia)
page, limit, offset = params
total = await db.scalar(select(func.count()).select_from(Model).where(...))
items = await db.execute(select(Model).where(...).offset(offset).limit(limit))
pages = math.ceil(total / limit)
return {"items": items, "total": total, "page": page, "pages": pages}
```

---

## Patrones Frontend

```tsx
// Thumbnail con fallback
const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())
{item.image_url && !imgErrors.has(item.id) ? (
  <img src={item.image_url} onError={() => setImgErrors(prev => new Set(prev).add(item.id))} />
) : <div className="w-10 h-10 bg-gray-100"><Package /></div>}

// Optimistic update toggle
setItems(prev => prev.map(i => i.id === id ? {...i, is_available: newVal} : i))
try { await businessApi.toggleCatalogItem(id, newVal) }
catch { setItems(prev => prev.map(i => i.id === id ? {...i, is_available: !newVal} : i)) }

// Badges de estado órdenes
pending/on-hold → amarillo | processing → azul | completed → verde
cancelled/failed → rojo | refunded → naranja
```

---

## Errores Conocidos

1. **asyncpg enum bug** → values_callable en todos los Enum
2. **JSONB no persiste** → flag_modified antes de commit
3. **CORS bloqueado** → casi siempre es 500/429, debug con curl OPTIONS
4. **Rate limiter bloquea OPTIONS** → skipear OPTIONS en rate_limit.py
5. **NEXT_PUBLIC_ vacío en prod** → ARG en Dockerfile + build arg en compose
6. **git pull falla** → git stash + chown -R hanowar /repo/
7. **Frontend OOM** → mem_limit 1.5g + swap 2GB
8. **Deploy timeout** → timeout-minutes: 20, command_timeout: 18m
9. **Ramas divergentes en VPS** → git config pull.rebase false && git pull
10. **bcrypt** → pin `bcrypt==4.0.1`

### Errores aprendidos en reconstrucción de mayo 2026

11. **Next.js 15.0.3 RCE CVE** → upgradear a 15.5.18+ (o última patch de rama 15.x)
12. **Containers como root** → SIEMPRE USER non-root en runtime stage; Node usa `USER node`, Python crea grupo dedicado
13. **`EACCES` en npm install con USER node** → en single-stage Dockerfiles, `RUN chown -R node:node /app` ANTES de cambiar a USER
14. **Celery beat sin permisos** → mount volume `/celery` con owner ventatalk y pasar `--schedule=/celery/celerybeat-schedule --pidfile=/celery/celerybeat.pid`
15. **Frontend healthcheck unhealthy con `localhost:3000`** → busybox-wget de alpine resuelve a IPv6 (`::1`) pero Next escucha `0.0.0.0`. Usar `http://127.0.0.1:3000` en healthchecks
16. **Nginx 1.18 no soporta `http2 on;`** → usar `listen 443 ssl http2;` inline (sintaxis vieja)
17. **`/etc/nginx/sites-enabled/`** carga TODOS los archivos sin importar extensión → `default.bak` causa conflictos `server_name`. Backups van a `sites-available/` o fuera
18. **bash interpola `$` en `psql -c "UPDATE..."`** → para hashes bcrypt `$2b$12$...`, usar `psql` interactivo no `-c "..."` con comillas dobles
19. **Donweb deja `/etc/ssh/sshd_config.d/custom.conf` con `PermitRootLogin yes`** → siempre revisar overrides al hardenear SSH nuevo
20. **Fail2ban auto-banea TU IP si tienes muchos retries** → agregar IP propia a `ignoreip` en `/etc/fail2ban/jail.local`

---

## Comandos VPS

```bash
# Acceso
ssh -p 5743 hanowar@179.43.124.82                    # SSH custom port

# Stack principal (ventatalk)
cd ~/ventatalk
docker compose -f docker-compose.prod.yml --env-file .env.production logs api --tail=50
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache api
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api
docker compose -f docker-compose.prod.yml --env-file .env.production exec api alembic upgrade head
docker compose -f docker-compose.prod.yml --env-file .env.production exec api alembic revision --autogenerate -m "descripcion"
docker compose -f docker-compose.prod.yml --env-file .env.production exec db psql -U ventatalk -d ventatalk_db

# Otros stacks
cd ~/ventatalk-web && docker compose --env-file .env.production up -d --build
cd ~/ventatalk-admin && docker compose --env-file .env.production up -d --build

# Operación
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker compose -f docker-compose.prod.yml down       # apagar stack ventatalk

# Nginx
sudo nginx -t                                         # validar config
sudo systemctl reload nginx                          # recargar
ls /etc/nginx/sites-enabled/                         # ver sitios activos

# Si hay problema con git pull (cambios locales en VPS)
git checkout -- archivo                               # descartar cambios locales
git pull                                              # ahora limpio
```

---

## Reglas de Negocio

- Conversación = hilo completo. Reset el día 1 de cada mes 00:05 UTC.
- is_available=False → bot no lee el producto en RAG
- Superadmin: login normal, verificado por SUPERADMIN_EMAIL=admin@ventatalk.com
- WhatsApp outbound: SOLO templates aprobados por Meta
- Tokens integración: siempre Fernet encrypt, UI solo últimos 4-8 chars

---

## Estado actual de Businesses en producción

| Nombre | UUID | Email | Plan | Uso |
|---|---|---|---|---|
| VentaTalk Admin Demo | `67546dec-9b0b-49a1-ae38-d2db96312310` | admin@ventatalk.com | starter | Superadmin |
| VentaTalk Web | `ac239145-a993-4661-9287-341c0ed91e40` | widget@ventatalk.com | starter | Widget público ventatalk.com |

---

## Clientes Piloto (pendientes de re-onboarding tras hack)

| Cliente | Integración | Estado pre-hack |
|---|---|---|
| Clínica cosmética | WordPress/WooCommerce | Plugin v1.1.0 instalado |
| Repuestos automotriz (MP Cars) | WordPress/WooCommerce | 539 productos, 49 órdenes synced |
| Pace Coffee Roasters (NathalieSPA) | Jumpseller | 15 productos synced |

**A re-onboardear:** pedir credenciales nuevas a cada cliente (las viejas se filtraron en el hack), reinstalar plugin/reconectar API, re-sync.

---

## Workflow Git correcto

> Regla: NUNCA editar directamente en VPS. Todo viene de GitHub.

```
Local (edit + commit + push) → GitHub → VPS (git pull) → docker compose up --build
```

Si por urgencia se edita en VPS:
1. Bajar cambios al local con `scp -P 5743 hanowar@179.43.124.82:~/path file`
2. Commitear desde local
3. Push a GitHub
4. En VPS: `git checkout -- archivos_modificados && git pull`

---

## Seguridad — Recordatorios

- **`.env.production` y `.env.development` NUNCA al repo.** Verificar `.gitignore` antes de cada commit.
- **Tokens de integración encriptados con Fernet** en `business.integrations`. UI muestra solo `...xxxx`.
- **Cualquier dependencia nueva**: revisar `npm audit` / `pip-audit` antes de mergear.
- **Containers SIEMPRE non-root** en runtime. Si necesitas root para apt, hazlo en stage builder y discard en runtime.
- **GitHub Deploy Keys** son read-only por diseño. NO marcar "Allow write access" para keys de VPS.

---

## Portfolio arturodev.info — Conviviendo en el mismo VPS

### Stack
- Frontend: Next.js 16 standalone, puerto host **3010** (interno 3000)
- Backend: Nest.js + Prisma ORM, puerto host **4010** (interno 4000)
- DB: PostgreSQL 16 (imagen `pgvector/pgvector:pg16` — ya cacheada en VPS, evita Docker Hub rate limit)
- Repo: `github.com/Arturado/arturodev` (público)
- Path en VPS: `/home/hanowar/arturodev/`

### Archivos clave
```
arturodev/
  docker-compose.prod.yml       ← prod (puertos 3010/4010, postgres sin exponer)
  docker-compose.yml            ← dev local
  frontend/Dockerfile           ← multi-stage con ARG/ENV para build-time vars
  backend/Dockerfile            ← Nest.js + Prisma generate
  .env.production               ← NO en repo, en VPS (/home/hanowar/arturodev/)
  .github/workflows/deploy.yml  ← appleboy SSH → docker compose up --build
```

### Nginx
```
/etc/nginx/sites-available/arturodev.info      → proxy 127.0.0.1:3010
/etc/nginx/sites-available/api.arturodev.info  → proxy 127.0.0.1:4010
```

### Comandos
```bash
cd ~/arturodev
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs backend --tail=30
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U arturodev_user -d arturodev
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npx prisma migrate deploy
```

### GitHub Actions deploy
- Secrets: `SERVER_HOST=179.43.124.82`, `SERVER_USER=hanowar`, `SERVER_PORT=5743`, `SERVER_SSH_KEY=arturodev_deploy privada`
- La misma key sirve para dos cosas: `.pub` en GitHub Deploy keys (VPS clona repo) + `.pub` en `~/.ssh/authorized_keys` del VPS (GitHub Actions SSHea al VPS)

---

## Errores aprendidos — arturodev (mayo 2026)

**10. Docker Hub rate limit** → usar imagen ya cacheada en VPS. Usar `pgvector/pgvector:pg16` en vez de `postgres:16`.

**11. Next.js build-time env vars** → `env_file` pasa vars al container en runtime, NO durante `docker build`. Para vars que Next.js necesita en build (ej. `RESEND_API_KEY` instanciada en route handler), usar `build.args` en compose + `ARG`/`ENV` en Dockerfile antes del `RUN npm run build`.

**12. Deploy key — doble registro** → la misma key ed25519 necesita estar en dos lugares: `.pub` en GitHub repo → Settings → Deploy keys (para que VPS clone), y `.pub` en `~/.ssh/authorized_keys` del VPS (para que GitHub Actions pueda SSH). Si falta alguno, falla con `unable to authenticate`.

**13. `git clean -fd` borra `.env.production`** → archivos untracked (`.env.production` en `.gitignore`) son eliminados por `git clean -fd`. Antes de correrlo, siempre revisar con `git clean -n`. Nunca usar `-fd` en repos de producción sin revisar.

**14. Cloudflare proxy naranja + Certbot HTTP-01** → con proxy naranja activo, el challenge HTTP-01 de Let's Encrypt falla porque Cloudflare intercepta el request antes de llegar al VPS. Solución: poner grey cloud temporalmente → generar cert → volver a naranja. Con cert válido en VPS, configurar SSL mode en "Full" o "Full (strict)" en Cloudflare (no "Flexible" — causa redirect loops).

**15. Cloudflare 502 ≠ CORS** → si el backend da 502 desde Cloudflare, no es problema de CORS headers sino que el backend no está respondiendo. Diagnosticar con `curl http://localhost:PUERTO` desde el VPS antes de asumir que es un problema de headers.

**16. Prisma `migrate dev` dentro del container no persiste** → genera archivos de migración dentro del filesystem del container, pero el Dockerfile hace `COPY . .` — es copia unidireccional en build time. La migración se aplica a la DB pero el archivo `.sql` desaparece al recrear el container. Siempre crear migraciones en **local** y commitearlas al repo.

**17. Prisma P3009 — migración failed** → si una migración queda en estado `failed` en `_prisma_migrations` (porque las tablas ya existían), Prisma bloquea todos los deploys siguientes. Fix:
```sql
UPDATE _prisma_migrations SET finished_at = NOW(), logs = NULL
WHERE migration_name = 'NOMBRE_MIGRACION';
```
