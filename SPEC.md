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
| `ventatalk-admin` | github.com/Arturado/ventatalk-admin | Activo — panel superadmin (MVP funcional) |

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
- `bcrypt==4.0.1` pinneado (compatibilidad con passlib 1.7.4)

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
- `007_orders_coupons` — tablas orders y coupons con UniqueConstraint por source

### Migraciones planeadas
- `008_catalog_product_url` — agrega `product_url` a CatalogItem (Tracking 2.0 Fase 1, ver sección 13)

### Modelos principales
- `Business` — tenant (cliente del SaaS)
- `PhoneNumber` — números WhatsApp por tenant
- `Contact` — clientes del negocio
- `Conversation` — hilos de conversación (campo `channel`: whatsapp/instagram)
- `Message` — mensajes individuales
- `Lead` — pipeline de ventas
- `CatalogItem` — productos con embeddings pgvector
- `Order`, `Coupon` — ingestados vía conectores
- `FollowUpSequence/Step/Log` — secuencias de seguimiento
- `ConversionToken` — tracking de conversiones `?vt_conv=`

### Campos importantes en Business
```python
plan: PlanType          # starter | pro | max
billing_cycle: str      # monthly | annual
stripe_customer_id: str
stripe_subscription_id: str
features: JSONB         # Record<string, boolean> — feature flags por tenant. null por defecto.
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
- `GET /orders` (paginado)
- `GET /coupons` (paginado)

### Conversaciones, Contactos, Leads, Analytics
- CRUD completo implementado

### Integraciones (`/api/v1/integrations/`)
- Jumpseller: connect, sync, status, disconnect
- Bsale: connect, sync, status, disconnect, price-lists
- Shopify: connect, sync, status, disconnect
- MercadoLibre: connect, sync, status, disconnect
- WooCommerce: token, status, ingest, ingest/orders, ingest/coupons, revoke

### Billing (`/api/v1/billing/`)
- `POST /create-checkout-session`
- `POST /webhook` (Stripe)
- `GET /portal`
- Maneja: checkout.session.completed, subscription.updated, subscription.deleted

### Tracking (`/api/v1/`)
- `POST /conversations/{id}/tracking-link`
- `GET /conversations/{id}/tracking-links`
- `GET /track/{token}` (público, redirige)
- Ver sección 13 para flujo completo y Tracking 2.0 planeado.

### Admin (`/api/v1/admin/`)
- `GET /stats/overview`
- `GET /businesses?page&search&limit` → `{ items, total, page, limit }`
- `GET /businesses/{id}` → mismo shape que un item de la lista
- `PATCH /businesses/{id}/features` — recibe `Record<string, boolean>`
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
| Conversaciones | `/dashboard/conversations` | ✅ con panel de tracking links integrado |
| Contactos | `/dashboard/contacts` | ✅ |
| Leads / Pipeline | `/dashboard/leads` | ✅ |
| Ecommerce / Productos | `/dashboard/ecommerce/productos` | ✅ |
| Ecommerce / Órdenes | `/dashboard/ecommerce/orders` | ✅ |
| Ecommerce / Cupones | `/dashboard/ecommerce/cupones` | ✅ |
| Integraciones | `/dashboard/integrations` | ✅ |
| Configuración | `/dashboard/settings` | ✅ |

**Pendiente de rediseño completo con Claude Design** (P1 — ver TODO.md).

---

## 10. Frontend `admin.ventatalk.com` — Estado

| Sección | Path | Estado |
|---|---|---|
| Login | `/auth/login` | ✅ funcional |
| Dashboard stats | `/dashboard` | ✅ verificado |
| Lista clientes | `/dashboard/clientes` | ✅ verificado |
| Detalle cliente | `/dashboard/clientes/[id]` | ✅ verificado (edición plan/features funcional) |

**Pendiente de rediseño con Claude Design** (P1 — ver TODO.md).

---

## 11. Integraciones de Catálogo

| Integración | Tipo | Estado | URL de producto |
|---|---|---|---|
| Jumpseller | Pull (API) | ✅ Funcionando — Pace Coffee 15 productos | `{shop_domain}/products/{permalink}` |
| Bsale | Pull (API) | ✅ Funcionando — 161 productos (límite 500) | ❌ No tiene tienda pública (ERP) |
| WooCommerce | Push (plugin WordPress) | ✅ Plugin instalado en MP Cars + clínica | `get_permalink($id)` |
| Shopify | Pull (API) | ✅ Implementado, sin cliente activo | `{shop_domain}/products/{handle}` |
| MercadoLibre | Pull (API) | ✅ Implementado, sin cliente activo | `permalink` del API |

### Plugin WordPress (`ventatalk`)
- Path en repo: `scripts/wordpress-plugin/ventatalk/`
- Versión actual: **v1.1.0**
- Funciones: widget WhatsApp, sync manual catálogo, sync automático en tiempo real (hooks WooCommerce)
- Configuración: token API + URL servidor en WordPress admin
- **Planeado v1.2.0:** agregar `product_url` al payload de productos (Tracking 2.0 Fase 2a)
- **Planeado v1.3.0:** registro de conversiones (Tracking 2.0 Fase 4a)

---

## 12. Workers Celery

| Task | Trigger | Función |
|---|---|---|
| Follow-up sequences | Beat scheduler | Envía mensajes de seguimiento |
| Reset conversaciones | Día 1 de cada mes 00:05 UTC | Resetea `conversations_this_month` |
| Embeddings WooCommerce | Background tras ingest | Genera embeddings para productos nuevos |

---

## 13. Tracking de Conversiones

### Estado actual (Tracking 1.0)

**Flujo:**
1. Agente humano abre conversación en `/dashboard/conversations`, le da al botón "Links".
2. Llena modal con `destination_url` (URL manual) y `label` opcional.
3. Frontend llama `POST /api/v1/conversations/{id}/tracking-link`.
4. Backend genera token, crea registro en `conversion_tokens`, devuelve `tracking_url = https://api.ventatalk.com/track/{token}`.
5. Agente copia el link al portapapeles, lo pega en su respuesta de WhatsApp.
6. Lead hace click → `GET /track/{token}` → backend marca click, redirige al `destination_url`.
7. Conversión se marca manualmente o vía webhook futuro (no implementado aún).

**Limitaciones actuales:**
- El link expone `api.ventatalk.com` → mala UX para el lead, branding débil para el cliente, confianza baja en WhatsApp.
- URLs de productos hay que copiarlas manualmente porque `CatalogItem` no tiene `product_url`.
- La IA no genera links automáticamente.
- No hay registro automático de conversiones (solo clicks).
- Sin dashboard agregado de conversiones.

### Tracking 2.0 — Diseño objetivo

**Cambio fundamental:** el link público es la URL del cliente con `?vt_conv={token}` appendado, no un dominio de VentaTalk.

**Ejemplo:**
```
Antes: https://api.ventatalk.com/track/RLS7zbK71AedbQ-kZkxTSrWdYvnPJpKwv0VH6yH9hV0
Después: https://pacecoffeeroasters.com/products/cafe-yirgacheffe?vt_conv=RLS7zbK71...
```

**Componentes:**

1. **Modelo:** `CatalogItem.product_url` (VARCHAR(500) NULL) — URL completa del producto en la tienda del cliente. Null para Bsale.

2. **Backfill por conector** durante sync:
   - WooCommerce: `get_permalink($id)` (plugin v1.2.0+)
   - Jumpseller: `{shop_domain}/products/{permalink}`
   - Shopify: `{shop_domain}/products/{handle}`
   - MercadoLibre: `permalink` del API
   - Bsale: `NULL` (documentado, sin tienda pública)

3. **Endpoint actualizado:** `POST /conversations/{id}/tracking-link` acepta:
   - `catalog_item_id` (preferido): backend resuelve `product_url` del item
   - `destination_url` (fallback manual): edge case, agente quiere mandar link no-producto
   - Si item no tiene `product_url` → error 400

4. **Registro de conversiones — 3 modos que conviven:**
   - **Plugin WordPress v1.3.0:** hook `woocommerce_thankyou`, lee cookie con token, llama `POST /track/{token}/conversion`.
   - **Pixel JS** (`/static/vt-pixel.js`): detecta `?vt_conv=`, guarda en cookie 90 días, dispara en thank-you page del cliente.
   - **Webhook de orden** (Jumpseller, Shopify): respaldo server-side, busca UTM/metadata de la orden.

5. **Compatibilidad:** `/track/{token}` se mantiene como fallback redirect para clientes sin pixel/plugin (degrada elegantemente).

6. **UI:**
   - Catálogo: columna "URL" con badge "Sin URL — no trackeable" cuando aplica.
   - Conversaciones: selector de producto del catálogo (dropdown searchable) reemplaza el input manual de URL.

**Documentación granular de fases en TODO.md.**

---

## 14. Canal Instagram (Add-on — Pendiente)

- Mismo agente IA respondiendo Instagram DM
- $20 USD/mes add-on
- Stack: Meta Graph API, permiso `instagram_manage_messages`
- CRM unificado con filtro por canal (whatsapp/instagram)
- Requiere review de Meta para producción

---

## 15. Pendientes Técnicos

> Lista resumida. Detalle priorizado en `TODO.md`.

### Críticos
_(ninguno crítico al día de hoy)_

### Alta prioridad
- Tracking 2.0 (6 fases — ver sección 13 y TODO.md)
- Rediseño completo `app.ventatalk.com` con Claude Design
- Rediseño `admin.ventatalk.com` con Claude Design

### Media prioridad
- Dashboard de conversiones agregado (`/analytics/conversions`)
- Módulo carritos abandonados
- Módulo Reviews
- IA genera tracking links automáticamente (depende de Tracking 2.0)
- Órdenes y cupones para Jumpseller, Bsale, Shopify, MercadoLibre

### Backlog
- Canal Instagram DM
- Módulo B2B / Cotizaciones
- Campañas outbound (Pro+)
- Bsale bulk price list

---

## 16. Decisiones Técnicas Clave

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
| `bcrypt==4.0.1` pinneado | Compatibilidad con passlib 1.7.4 |
| `git stash` en deploy | Evita conflictos cuando se editan archivos directo en VPS |
| `next build` corre `tsc` en TODO el repo | Los fixes de tipo deben ser end-to-end; no hay "commit parcial con errores pendientes" |
| Tracking link usa dominio del cliente (Tracking 2.0) | UX, confianza del lead, branding. Mantenemos `/track/{token}` solo como fallback |
| Bash interpola `$` en hashes bcrypt | Para reset de password en DB: usar `psql` interactivo, no `psql -c "..."` con doble quote |