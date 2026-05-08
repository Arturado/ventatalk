# VentaTalk — SPEC General del Proyecto

> Documento de referencia técnica y de producto. Actualizar antes de iniciar cualquier desarrollo nuevo.
> Última actualización: Mayo 2026

---

## 1. Visión General

VentaTalk es un agente de ventas IA para WhatsApp + CRM, orientado a PYMEs chilenas y latinoamericanas. El producto es multi-tenant: cada cliente tiene su propio espacio aislado con su catálogo, conversaciones y configuración.

---

## 2. Arquitectura de Subdominios

| Subdominio | Repo | Puerto | Propósito |
|---|---|---|---|
| `ventatalk.com` | `ventatalk-web` | 3001 | Landing, planes, registro, checkout Stripe |
| `app.ventatalk.com` | `ventatalk` (frontend) | 3000 | Dashboard del cliente |
| `api.ventatalk.com` | `ventatalk` (backend) | 8000 | API FastAPI — compartida por todos |
| `admin.ventatalk.com` | `ventatalk-admin` | 3002 | Panel interno VentaTalk (superadmin) |

---

## 3. Repositorios

| Repo | URL | Estado |
|---|---|---|
| `ventatalk` | github.com/Arturado/ventatalk | Activo — app + backend |
| `ventatalk-web` | github.com/Arturado/ventatalk-web | Activo — landing |
| `ventatalk-admin` | github.com/Arturado/ventatalk-admin | Activo — panel superadmin (MVP en progreso) |

### Estructura en VPS (`/home/hanowar/`)
```
ventatalk/              ← repo principal (backend + frontend app)
ventatalk-web/          ← landing ventatalk.com
ventatalk-admin/        ← panel superadmin
wordpress-agencia-dn/   ← instancia WordPress cliente (no tocar)
```

### Deploy automático
- Cada repo tiene `.github/workflows/deploy.yml`
- Push a `main` → GitHub Actions → SSH al VPS → `git stash + git pull + docker compose up --build`
- Secrets en GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`

---

## 4. Stack Técnico

### Backend
- Python + FastAPI (async)
- SQLAlchemy async + PostgreSQL + pgvector
- Celery + Redis (workers y beat scheduler)
- OpenAI GPT-4o-mini (RAG + embeddings)
- Fernet encryption para tokens de integraciones

### Frontend (app + admin)
- Next.js + Tailwind CSS
- Auth con JWT (localStorage + cookie `admin_token` para el admin)
- `output: "standalone"` en `next.config.ts`

### Infraestructura
- VPS único IP `179.43.124.82` (Donweb)
- Docker Compose por proyecto
- Nginx como reverse proxy + SSL Certbot
- `admin.ventatalk.com` con `X-Robots-Tag: noindex, nofollow`
- Swap 2GB configurado en VPS
- CI/CD: GitHub Actions

---

## 5. Variables de Entorno

### Estructura
- Local: `.env.development` (no va al repo)
- VPS: `.env.production` (no va al repo)
- Repo: `.env.example` (sin valores reales)

### Variables clave de producción (VPS)
```
APP_ENV=production
APP_URL=https://app.ventatalk.com
API_URL=https://api.ventatalk.com
NEXT_PUBLIC_API_URL=https://api.ventatalk.com
SUPERADMIN_EMAIL=admin@ventatalk.com
```

---

## 6. Modelo de DB — Estado Actual

### Migraciones aplicadas
- `001_initial` — tablas base
- `002_catalog_integrations`
- `003_business_integrations`
- `004_conversion_tokens`
- `005_plan_catalog_limit`
- `006_add_billing_features_channel` — billing, features JSONB, channel en conversaciones

### Modelos principales
- `Business` — tenant (cliente del SaaS)
- `PhoneNumber` — números WhatsApp por tenant
- `Contact` — clientes del negocio
- `Conversation` — hilos de conversación (campo `channel`: whatsapp/instagram)
- `Message` — mensajes individuales
- `Lead` — pipeline de ventas
- `CatalogItem` — productos con embeddings pgvector
- `FollowUpSequence/Step/Log` — secuencias de seguimiento
- `ConversionToken` — tracking de conversiones `?vt_conv=`

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
```

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

---

## 8. Endpoints Backend — Estado Actual

### Auth (`/api/v1/auth/`)
- `POST /login` — OAuth2PasswordRequestForm
- `POST /register`
- `POST /refresh`
- `GET /me`

### Business (`/api/v1/business/`)
- `GET/PUT /profile`
- `GET /catalog`
- `POST /catalog` (upload CSV)
- `GET /usage`

### Conversaciones, Contactos, Leads, Analytics
- CRUD completo implementado

### Integraciones (`/api/v1/integrations/`)
- Jumpseller: connect, sync, status, disconnect
- Bsale: connect, sync, status, disconnect, price-lists
- Shopify: connect, sync, status, disconnect
- MercadoLibre: connect, sync, status, disconnect
- WooCommerce: token, status, ingest, revoke

### Billing (`/api/v1/billing/`)
- `POST /create-checkout-session`
- `POST /webhook` (Stripe)
- `GET /portal`
- Maneja: checkout.session.completed, subscription.updated, subscription.deleted

### Tracking (`/api/v1/`)
- `POST /conversations/{id}/tracking-link`
- `GET /conversations/{id}/tracking-links`
- `GET /track/{token}` (público, redirige)

### Admin (`/api/v1/admin/`) ← NUEVO
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
| Login | `/auth/login` | ✅ |
| Dashboard overview | `/dashboard` | ✅ |
| Conversaciones | `/dashboard/conversations` | ✅ |
| Contactos | `/dashboard/contacts` | ✅ |
| Leads / Pipeline | `/dashboard/leads` | ✅ |
| Integraciones | `/dashboard/integrations` | ✅ |
| Configuración | `/dashboard/settings` | ✅ |

**Pendiente de rediseño completo con Claude Design.**

---

## 10. Frontend `admin.ventatalk.com` — Estado

| Sección | Path | Estado |
|---|---|---|
| Login | `/auth/login` | ✅ funcional |
| Dashboard stats | `/dashboard` | ✅ implementado, pendiente verificar |
| Lista clientes | `/dashboard/clientes` | ✅ implementado, pendiente verificar |
| Detalle cliente | `/dashboard/clientes/[id]` | ✅ implementado, pendiente verificar |

**Bug conocido:** El middleware de Next.js estaba nombrado `proxy` en lugar de `middleware` — ya corregido. Verificar flujo completo de login → dashboard.

---

## 11. Integraciones de Catálogo

| Integración | Tipo | Estado |
|---|---|---|
| Jumpseller | Pull (API) | ✅ Funcionando — Pace Coffee 15 productos |
| Bsale | Pull (API) | ✅ Funcionando — 161 productos (límite 500) |
| WooCommerce | Push (plugin WordPress) | ✅ Plugin instalado en cliente |
| Shopify | Pull (API) | ✅ Implementado, sin cliente activo |
| MercadoLibre | Pull (API) | ✅ Implementado, sin cliente activo |

### Plugin WordPress (`ventatalk`)
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

---

## 13. Canal Instagram (Add-on — Pendiente)

- Mismo agente IA respondiendo Instagram DM
- $20 USD/mes add-on
- Stack: Meta Graph API, permiso `instagram_manage_messages`
- CRM unificado con filtro por canal (whatsapp/instagram)
- Requiere review de Meta para producción

---

## 14. Pendientes Técnicos

### Críticos
- [ ] Verificar flujo completo login → dashboard en `admin.ventatalk.com`
- [ ] Frontend `app.ventatalk.com` cae solo (OOM) — swap 2GB + mem_limit 1.5g aplicados, monitorear

### Alta prioridad
- [ ] Rediseño completo frontend `app.ventatalk.com` con Claude Design
- [ ] Completar `ventatalk-admin` — verificar todas las pantallas

### Media prioridad
- [ ] Módulo carritos abandonados (extender Celery beat)
- [ ] Módulo Reviews (solicitar reseña al cierre de conversación)
- [ ] Conversion tracking `?vt_conv=` — lógica frontend pendiente

### Backlog
- [ ] GitHub Actions para `ventatalk-admin` (falta deploy key en repo)
- [ ] Bsale bulk price list (fix precios faltantes por variante)
- [ ] Límite productos Bsale dinámico por plan
- [ ] Módulo B2B / Cotizaciones
- [ ] Canal Instagram DM

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
