# VentaTalk — SPEC General del Proyecto

> Documento de referencia técnica y de producto. Actualizar antes de iniciar cualquier desarrollo nuevo.
> Última actualización: Mayo 2026 (post-reconstrucción VPS)

---

## 1. Visión General

VentaTalk es un agente de ventas IA para WhatsApp + CRM, orientado a PYMEs chilenas y latinoamericanas. El producto es multi-tenant: cada cliente tiene su propio espacio aislado con su catálogo, conversaciones y configuración.

---

## 2. Arquitectura de Subdominios

| Subdominio | Repo | Puerto local | Propósito |
|---|---|---|---|
| `ventatalk.com` | `ventatalk-web` | 3001 | Landing, planes, registro, checkout Stripe |
| `app.ventatalk.com` | `ventatalk` (frontend) | 3000 | Dashboard del cliente |
| `api.ventatalk.com` | `ventatalk` (backend) | 8000 | API FastAPI — compartida por todos |
| `admin.ventatalk.com` | `ventatalk-admin` | 3002 | Panel interno VentaTalk (superadmin) |

Todos sirviendo HTTPS desde un único VPS en `179.43.124.82` (Donweb) vía Nginx → containers Docker.

---

## 3. Repositorios

| Repo | URL | Versión Next.js | Estado |
|---|---|---|---|
| `ventatalk` | github.com/Arturado/ventatalk | 15.5.18 | Activo — backend + frontend app |
| `ventatalk-web` | github.com/Arturado/ventatalk-web | 14.2.29 ⚠️ | Activo — landing (migrar a 15.x P1) |
| `ventatalk-admin` | github.com/Arturado/ventatalk-admin | 16.2.6 | Activo — panel superadmin |

### Estructura en VPS (`/home/hanowar/`)
```
ventatalk/              ← repo principal (backend + frontend app)
ventatalk-web/          ← landing ventatalk.com
ventatalk-admin/        ← panel superadmin
.ssh/deploy_keys/       ← 3 deploy keys (1 por repo), read-only
```

### Deploy automático
- Cada repo tiene `.github/workflows/deploy.yml`
- Push a `main` → GitHub Actions → SSH al VPS → `git stash + git pull + docker compose up --build`
- Secrets en GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`
- ⚠️ Tras reconstrucción: verificar que GitHub Secrets apuntan a las nuevas deploy keys

---

## 4. Stack Técnico

### Backend
- Python 3.12 + FastAPI (async)
- SQLAlchemy async + PostgreSQL 16 + pgvector
- Celery + Redis 7 (worker + beat scheduler con volume persistente)
- OpenAI GPT-4o-mini (RAG + embeddings text-embedding-3-small)
- Fernet encryption para tokens de integraciones
- Dockerfile **multi-stage** con `USER ventatalk` (non-root) en runtime

### Frontend (app + admin)
- Next.js + Tailwind CSS
- Auth con JWT (localStorage + cookie `admin_token` para el admin)
- `output: "standalone"` en `next.config.ts` (frontend principal y admin)
- Dockerfile **multi-stage** con `USER node` (non-root) en runtime

### ventatalk-web
- Next.js single-stage build
- Dockerfile con `chown -R node:node /app` + `USER node`
- Sin standalone output

### Infraestructura
- VPS único `179.43.124.82` (Donweb)
- Ubuntu 22.04 LTS, 5.8 GB RAM + 2 GB swap, 45 GB disco
- Docker Compose por proyecto
- Nginx 1.18.0 como reverse proxy + SSL Certbot (snap)
- `admin.ventatalk.com` con `X-Robots-Tag: noindex, nofollow`
- CI/CD: GitHub Actions

### Hardening (post-hack mayo 2026)
- SSH solo por key en puerto **5743** (puerto 22 cerrado en UFW y Donweb edge firewall)
- Root login deshabilitado, password auth deshabilitado
- Usuario `hanowar` con sudo, key-only auth, en grupo docker
- UFW activo: 5743/80/443 abiertos; resto cerrado
- Fail2ban activo (3 fails/10min = ban 1h, IP propietaria en `ignoreip`)
- Donweb edge firewall configurado en paralelo (defensa en profundidad)
- Containers **non-root** en todos los servicios (frontend node, backend ventatalk, web node, admin node)
- Sin `gcc`/`-dev` en imágenes runtime (multi-stage los descarta)
- Automatic-Reboot deshabilitado en unattended-upgrades

---

## 5. Variables de Entorno

### Estructura
- Local: `.env.development` (en `.gitignore`, NUNCA al repo)
- VPS: `.env.production` (en `.gitignore`, NUNCA al repo)
- Repo: `.env.example` (sin valores reales)

### Variables clave de producción (VPS)
```
APP_ENV=production
APP_URL=https://app.ventatalk.com
API_URL=https://api.ventatalk.com
NEXT_PUBLIC_API_URL=https://api.ventatalk.com
SUPERADMIN_EMAIL=admin@ventatalk.com
POSTGRES_USER=ventatalk    # renombrado desde "ventabot"
POSTGRES_DB=ventatalk_db   # renombrado desde "ventabot_db"
WIDGET_BUSINESS_ID=ac239145-a993-4661-9287-341c0ed91e40
```

### Credenciales sensibles (en password manager, rotadas mayo 2026)
- SECRET_KEY (JWT)
- FERNET_KEY (encrypt de tokens)
- POSTGRES_PASSWORD
- OPENAI_API_KEY
- STRIPE_SECRET_KEY (rolled en panel)
- META_VERIFY_TOKEN

### Pendientes de configurar
- STRIPE_WEBHOOK_SECRET (después de crear webhook en panel Stripe)
- WA_TEST_ACCESS_TOKEN, META_APP_SECRET (regenerar en developers.facebook.com)

---

## 6. Modelo de DB — Estado Actual

### Migraciones aplicadas
- `001_initial` — tablas base
- `002_catalog_integrations` — campos `source` y `external_id` en catalog_items
- `003_business_integrations` — `integrations` JSONB en businesses
- `004_conversion_tokens` — tabla conversion_tokens
- `005_plan_catalog_limit` — `max_catalog_items` en businesses
- `006_billing_features_channel` — billing fields, features JSONB, channel en conversations
- `007_orders_coupons` — tablas orders y coupons
- `008_catalog_product_url` — campo `product_url` (Tracking 2.0 Fase 1)

### Modelos principales
- `Business` — tenant (cliente del SaaS)
- `PhoneNumber` — números WhatsApp por tenant
- `Contact` — clientes del negocio
- `Conversation` — hilos de conversación (campo `channel`: whatsapp/instagram)
- `Message` — mensajes individuales
- `Lead` — pipeline de ventas
- `CatalogItem` — productos con embeddings pgvector + `product_url`
- `FollowUpSequence/Step/Log` — secuencias de seguimiento
- `ConversionToken` — tracking de conversiones `?vt_conv=`
- `Order` — órdenes sincronizadas desde ecommerce
- `Coupon` — cupones sincronizados desde ecommerce

### Campos importantes en Business
```python
plan: PlanType          # starter | pro | max
billing_cycle: str      # monthly | annual
stripe_customer_id: str
stripe_subscription_id: str
features: JSONB         # features activos por plan + add-ons
conversations_this_month: int
conversations_reset_at: datetime
max_phone_numbers: int
max_conversations_per_month: int
max_catalog_items: int
integrations: JSONB     # config encriptada de cada integración
```

### Businesses creados (post-reconstrucción)
| Nombre | UUID | Email | Plan |
|---|---|---|---|
| VentaTalk Admin Demo | `67546dec-9b0b-49a1-ae38-d2db96312310` | admin@ventatalk.com | starter |
| VentaTalk Web | `ac239145-a993-4661-9287-341c0ed91e40` | widget@ventatalk.com | starter |

---

## 7. Planes y Pricing

### Planes base

| | Starter | Pro | MAX |
|---|---|---|---|
| Precio mensual | $90 USD | $190 USD | $499 USD |
| Precio anual | $900 USD | $1,900 USD | $4,790 USD |
| Conversaciones | 200 | 1,000 | 3,000 |
| Conv. adicional | $0.40 | $0.40 | $0.30 |
| Números WhatsApp | 1 | 3 | 4 |
| Carritos abandonados | ✅ | ✅ | ✅ |
| Campañas outbound | ❌ | ✅ | ✅ |
| Módulo Reviews | ❌ | ✅ | ✅ |
| Módulo B2B | ❌ | ❌ | ✅ |

### Add-ons
| Add-on | USD/mes |
|---|---|
| Tienda adicional | $150 |
| WhatsApp adicional | $20 |
| Bolsa conversaciones | $150 |
| MercadoLibre | $150 |
| Instagram | $20 |

Stripe price IDs configurados:
- `STRIPE_PRICE_STARTER=price_1TOVtfEmXjEhxagVXBLqfG2J`
- `STRIPE_PRICE_PRO=price_1TOVzCEmXjEhxagVG0lQkCKl`
- `STRIPE_PRICE_MAX=price_1TOVzTEmXjEhxagVmwSVSilq`

---

## 8. Endpoints Backend — Estado Actual

### Auth (`/api/v1/auth/`)
- `POST /login` — OAuth2PasswordRequestForm (username = email)
- `POST /register` — crea business + tokens
- `POST /refresh`
- `GET /me`

### Business (`/api/v1/business/`)
- `GET/PUT /profile`
- `GET /catalog`, `POST /catalog` (CSV upload)
- `DELETE /catalog/source/{name}`
- `PATCH /catalog/{id}/toggle`
- `GET/POST /catalog/source`
- `GET /orders?page&limit&search&status&payment_method` (paginado)
- `GET /coupons?page&limit&search&is_active` (paginado)
- `GET /usage`

### Conversaciones, Contactos, Leads, Analytics
CRUD completo implementado.

### Integraciones (`/api/v1/integrations/`)
- Jumpseller: connect, sync (con auto-detect URL prefix), status, disconnect
- Bsale: connect, sync, status, disconnect, price-lists
- Shopify: connect, sync, status, disconnect
- MercadoLibre: connect, sync, status, disconnect
- WooCommerce: token, status, ingest (productos/órdenes/cupones), revoke

### Billing (`/api/v1/billing/`)
- `POST /create-checkout-session`
- `POST /webhook` (Stripe — pendiente configurar webhook secret post-reconstrucción)
- `GET /portal`
- Maneja: `checkout.session.completed`, `subscription.updated`, `subscription.deleted`

### Tracking (`/api/v1/`)
- `POST /conversations/{id}/tracking-link`
- `GET /conversations/{id}/tracking-links`
- `GET /track/{token}` (público, redirige)

### Admin (`/api/v1/admin/`)
- `GET /stats/overview`
- `GET /businesses?page=&search=&limit=`
- `GET /businesses/{id}`
- `PATCH /businesses/{id}/features`
- `PATCH /businesses/{id}/plan`
- Requiere: JWT + email == SUPERADMIN_EMAIL

### Webhook (`/webhook/`)
- WhatsApp inbound messages

### Chat Widget (`/api/v1/chat/widget`)
- Chat público para ventatalk.com

---

## 9. Frontend `app.ventatalk.com` — Secciones

| Sección | Path | Estado |
|---|---|---|
| Login | `/auth/login` | ✅ Claude Design |
| Register | `/auth/register` | ✅ Claude Design |
| Reset Password | `/auth/reset` | ✅ Claude Design |
| Dashboard overview | `/dashboard` | ✅ funcional, rediseño pendiente |
| Conversaciones | `/dashboard/conversations` | ✅ Claude Design |
| Contactos | `/dashboard/contacts` | ✅ funcional, rediseño pendiente |
| Leads / Pipeline | `/dashboard/leads` | ✅ funcional, rediseño pendiente |
| Ecommerce / Productos | `/dashboard/ecommerce/productos` | ✅ |
| Ecommerce / Órdenes | `/dashboard/ecommerce/orders` | ✅ |
| Ecommerce / Cupones | `/dashboard/ecommerce/cupones` | ✅ |
| Integraciones | `/dashboard/integrations` | ✅ funcional, rediseño pendiente |
| Configuración | `/dashboard/settings` | ✅ funcional, rediseño pendiente |

**Pendiente rediseño completo con Claude Design (P1).**

---

## 10. Frontend `admin.ventatalk.com` — Estado

| Sección | Path | Estado |
|---|---|---|
| Login | `/auth/login` | ✅ funcional |
| Dashboard stats | `/dashboard` | ✅ MVP |
| Lista clientes | `/dashboard/clientes` | ✅ MVP (smoke tested) |
| Detalle cliente | `/dashboard/clientes/[id]` | ✅ MVP (smoke tested) |

**Pendiente rediseño completo con Claude Design (P1).**

---

## 11. Integraciones de Catálogo

| Integración | Tipo | Estado |
|---|---|---|
| Jumpseller | Pull (API, auto-detect URL prefix) | ✅ Implementado |
| Bsale | Pull (API) | ✅ Implementado (límite 500) |
| WooCommerce | Push (plugin WordPress) | ✅ Plugin v1.1.0 |
| Shopify | Pull (API) | ✅ Implementado, sin cliente activo |
| MercadoLibre | Pull (API) | ✅ Implementado, sin cliente activo |

### Plugin WordPress (`ventatalk` v1.1.0)
- Path en repo: `scripts/wordpress-plugin/ventatalk/`
- Funciones: widget WhatsApp, sync manual catálogo, sync automático en tiempo real (hooks WooCommerce)
- Configuración: token API + URL servidor en WordPress admin

---

## 12. Workers Celery

| Task | Trigger | Función |
|---|---|---|
| Follow-up sequences | Beat scheduler | Envía mensajes de seguimiento |
| Reset conversaciones | Día 1 de cada mes 00:05 UTC | Resetea `conversations_this_month` |
| Embeddings WooCommerce | Background tras ingest | Genera embeddings para productos nuevos |

### Volumes Docker (producción)
- `postgres_data` → DB
- `redis_data` → Redis persistence
- `celery_beat_data` → `/celery` (schedule file + pidfile, requerido por USER non-root)

---

## 13. Tracking 2.0 — Arquitectura (en progreso)

### Objetivo
Reemplazar URLs públicas `api.ventatalk.com/track/{token}` por URLs nativas del cliente `{shop_domain}/products/{slug}?vt_conv={token}` para mejor UX y branding.

### Fases
- **Fase 1 ✅** — Campo `product_url` en catalog_items (migración 008)
- **Fase 2a ✅** — Jumpseller backfill (fetch individual `permalink` por producto)
- **Fase 2a.1 ✅** — Auto-detect URL prefix Jumpseller (HEAD probe `/products/{slug}` vs `/{slug}`, cache en `business.integrations.jumpseller.url_prefix`)
- **Fase 2b** — WooCommerce plugin v1.2.0 con `product_url` (push)
- **Fase 2c** — Shopify backfill
- **Fase 2d** — Bsale → NULL (no expone permalinks)
- **Fase 2e** — MercadoLibre backfill
- **Fase 3** — Nuevo endpoint `POST /conversations/{id}/tracking-link` con `catalog_item_id` que devuelve URL completa
- **Fase 4** — Plugin WordPress v1.3.0 con conversion tracking + Pixel JS (script en página del cliente)
- **Fase 5** — UI: column en catálogo (link visible), selector en conversaciones
- **Fase 6** — Domain override por cliente (cuando usan dominio propio distinto al de la tienda)

### Cache de configuración por business
```
business.integrations.jumpseller = {
  shop_url: "https://pacecoffeeroasters.com",
  url_prefix: "/products/",  # o "/" si la tienda no usa /products/
  access_token: <encrypted>,
  ...
}
```

---

## 14. Canal Instagram (Add-on — Pendiente)

- Mismo agente IA respondiendo Instagram DM
- $20 USD/mes add-on
- Stack: Meta Graph API, permiso `instagram_manage_messages`
- CRM unificado con filtro por canal (whatsapp/instagram)
- Requiere review de Meta para producción

---

## 15. Decisiones Técnicas Clave

| Decisión | Razón |
|---|---|
| Backend compartido entre los 3 frontends | Un solo punto de verdad |
| Plugin push para WordPress (no pull) | No requiere credenciales del cliente |
| Admin en repo separado | Deploy independiente |
| Stripe vive en ventatalk.com | Separa billing del dashboard operativo |
| Conversación = hilo completo | No por mensaje — más justo para el cliente |
| Instagram en CRM unificado | Misma vista con filtro de canal |
| Features por tenant en JSONB | Activar/desactivar módulos sin redesplegar |
| SUPERADMIN_EMAIL en .env | Más simple y seguro que campo en DB para MVP |
| `asyncpg enum casing bug` | Fix: `values_callable=lambda x: [e.value for e in x]` en todos los Enum columns |
| `bcrypt` | Pin `bcrypt==4.0.1` |
| `git stash` en deploy | Evita conflictos cuando se editan archivos directo en VPS |
| `POSTGRES_USER=ventatalk` (rename desde `ventabot`) | Consistencia con nombre del proyecto, momento del rebuild |
| **Containers non-root** | Defensa en profundidad — bug en Next.js no escala a root del host |
| **Multi-stage Dockerfile en backend** | Sin gcc/-dev en runtime, ~50% menos peso |
| **Volume `celery_beat_data`** | Schedule de beat persiste entre reinicios, container non-root puede escribir |
| **Nginx 1 archivo por subdominio** | Modular; error en uno no tumba los otros |
| **Deploy keys read-only por repo** | Compromiso del VPS no permite pushear código malicioso |
| **Tracking 2.0 con URL nativa** | Mejor UX (cliente ve su propio dominio), mejor SEO |

---

## 16. Lecciones del hack de mayo 2026

### Qué pasó
VPS original suspendido por Donweb el 2026-05-13. Detectado binario malicioso `/g6mGrjY` corriendo como root + procesos zombie de cleanup. Vector de ataque: **CVE en Next.js 15.0.3** (RCE vulnerability).

### Por qué fue posible
1. **Next.js 15.0.3 sin parchar** (vector directo)
2. **Containers Docker corriendo como root** (escalada al host)
3. **Sin alertas automáticas de CVE** (no había Dependabot)

### Qué cambió tras la reconstrucción
1. Next.js actualizado a 15.5.18 en frontend principal
2. Los 4 Dockerfiles con USER non-root
3. Multi-stage en backend (sin gcc en runtime)
4. SSH hardenizado (puerto custom, key-only, fail2ban)
5. UFW + Donweb edge firewall (doble capa)
6. Containers en stack separado del host

### Qué falta para no repetirse
- Dependabot/Renovate en los 3 repos
- Monitoreo proactivo (UptimeRobot)
- Backups automáticos a almacenamiento externo
- Migrar `ventatalk-web` de Next 14 (rama no soportada) a 15
- Resolver `npm audit` pendiente en frontend

---

## 17. Workflow Git (regla operativa)

```
LOCAL (edit + commit + push) → GitHub → VPS (git pull) → docker compose up --build
```

**NUNCA editar directo en VPS.** Si fuerza mayor lo requiere:
1. `scp` el archivo a local
2. Commit + push desde local
3. En VPS: `git checkout -- archivos && git pull`
