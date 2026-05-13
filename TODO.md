# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Mayo 2026

---

## 🔴 P0 — Crítico

_(vacío — todo lo crítico al día)_

---

## 🟠 P1 — Alta prioridad

### Módulo Tracking 2.0 (URL del cliente con `?vt_conv=`)

> **Objetivo:** Reemplazar el link público `api.ventatalk.com/track/{token}` por una URL del dominio del cliente con `?vt_conv={token}` appendado, para mejor UX, branding del cliente y mayor confianza del lead final.
> **Justificación de prioridad:** valor directo para el cliente (mide ventas atribuidas a VentaTalk), va antes del rediseño porque "demostrar ventas" es lo que retiene clientes pagados.
> **Documentación completa:** ver SPEC.md sección 13.

- [ ] **Fase 1 — Modelo de datos: `product_url` en CatalogItem**
  - Migración Alembic `008_catalog_product_url`: agregar campo `product_url VARCHAR(500) NULL`
  - Modelo SQLAlchemy actualizado
  - `GET /business/catalog` devuelve `product_url`
  - Interface `CatalogItem` en `lib/api.ts` actualizada
  - Deploy seguro: campo `null` por defecto, no rompe nada existente

- [ ] **Fase 2 — Backfill por conector (llenar `product_url` durante sync)**
  - [ ] 2a. WooCommerce (plugin push) → `get_permalink($id)` en payload. Bump a v1.2.0
  - [ ] 2b. Jumpseller (pull) → `https://{shop_domain}/products/{permalink}`
  - [ ] 2c. Shopify (pull) → `handle` + `myshopify_domain` o custom domain
  - [ ] 2d. Bsale → `NULL` (Bsale es ERP, no tiene tienda pública). Documentar.
  - [ ] 2e. MercadoLibre (pull) → `permalink` del API

- [ ] **Fase 3 — Endpoint de tracking link con `catalog_item_id`**
  - Nuevo input: `catalog_item_id` (opcional) o `destination_url` (manual, edge case)
  - Backend resuelve `product_url` del item y arma `tracking_url = {product_url}?vt_conv={token}`
  - Si item sin `product_url`: error 400 explicativo
  - Mantener `/track/{token}` como fallback para clientes sin pixel/plugin

- [ ] **Fase 4 — Registro de conversiones (cliente → backend)**
  - [ ] 4a. Plugin WordPress v1.3.0: hook `woocommerce_thankyou`/`woocommerce_order_status_completed`, leer `?vt_conv=` de cookie persistente, llamar `POST /api/v1/track/{token}/conversion`
  - [ ] 4b. Pixel JS (`/static/vt-pixel.js`): detectar `?vt_conv=`, guardar cookie 90 días, disparar en thank-you page
  - [ ] 4c. Webhooks de orden por plataforma (Jumpseller, Shopify) como respaldo

- [ ] **Fase 5 — UI catálogo y conversaciones**
  - Columna "URL" en `/dashboard/ecommerce/productos` con badge "Sin URL — no trackeable"
  - Edit inline de `product_url`
  - En `/dashboard/conversations` panel de tracking: selector de producto del catálogo (dropdown searchable) + fallback "URL custom"

- [ ] **Fase 6 — Configuración de dominio del cliente (override)**
  - UI en settings para overridear dominio detectado
  - Solo necesario para clientes con dominio custom no detectable automáticamente

### Otros P1

- [ ] **Rediseño completo `app.ventatalk.com`** con Claude Design
  - Pantallas pendientes: dashboard overview, contactos, leads, integraciones, settings
  - Login, Register, Reset Password, Conversaciones ya implementados con Claude Design
  - Flujo: Claude Design → handoff → Claude Code → integrar con API existente

- [ ] **Rediseño `admin.ventatalk.com`** con Claude Design
  - Backend ya implementado, solo refinar el frontend

---

## 🟡 P2 — Media prioridad

- [ ] **Dashboard de conversiones agregado** (`/dashboard/analytics/conversions`)
  - Después de Tracking 2.0 con datos reales fluyendo
  - Ventas atribuidas, top productos, tasa de conversión por canal
  - Atajo desde el dashboard principal con cifra del mes

- [ ] **Módulo carritos abandonados**
  - El agente detecta consultas de compra sin completar
  - Enviar follow-up automático vía WhatsApp (extender Celery beat)
  - Disponible en todos los planes

- [ ] **Módulo Reviews**
  - El agente solicita reseña al finalizar conversación/compra
  - Redirige a Google Maps u otro según config del tenant
  - Plan Pro y MAX

- [ ] **IA genera tracking links automáticamente** (Fase 3 conceptual)
  - Tool del agente: `generate_tracking_link(catalog_item_id)`
  - Modificar prompt para que use links trackeables al recomendar productos
  - Requiere Tracking 2.0 Fase 1-3 completas
  - Pilotar primero con un solo cliente (Pace o MP Cars)

- [ ] **GitHub Actions para `ventatalk-admin`**
  - Falta agregar deploy key al repo de GitHub
  - Workflow ya existe en `.github/workflows/deploy.yml`
  - **NOTA:** posiblemente ya completado — deploys recientes funcionan. Verificar.

- [ ] **Órdenes y Cupones — otras integraciones**
  - WooCommerce ✅ implementado
  - Jumpseller, Bsale, Shopify, MercadoLibre pendientes

---

## 🔵 P3 — Backlog

- [ ] **Canal Instagram DM** (add-on $20)
  - Meta Graph API + permiso `instagram_manage_messages`
  - Requiere review de Meta para producción
  - CRM unificado con filtro por canal

- [ ] **Módulo B2B / Cotizaciones** (Plan MAX)
  - Agente genera cotizaciones o responde precios por WhatsApp
  - Cliente elige modalidad desde su dashboard

- [ ] **Campañas outbound / WhatsApp Marketing** (Plan Pro+)
  - IMPORTANTE: solo con templates aprobados por Meta
  - Evaluar: integración Mailchimp vs servicio propio

- [ ] **Crear cupones desde VentaTalk**
  - Actualmente solo visualización
  - A futuro: crear cupones en la plataforma del cliente desde VentaTalk

- [ ] **Bsale bulk price list**
  - Fix precios faltantes por variante
  - Límite de 500 productos dinámico por plan

- [ ] **Shopify, MercadoLibre** — sin cliente activo todavía

---

## ⚙️ Deuda Técnica

- [ ] **OOM frontend** — mem_limit 1.5g + swap 2GB aplicados, monitorear
- [ ] **Pipeline status** visible en conversaciones
- [ ] **Optimización embeddings** — batch processing para reducir costos OpenAI
- [ ] **Tests** — no hay tests automatizados
- [ ] **Sincronización TODO.md / código** — establecer hábito de actualizar TODO en el mismo commit que cambia funcionalidad (descubrimos que "Conversion tracking UI" figuraba como pendiente cuando ya estaba implementado en `dashboard/conversations`)

---

## ✅ Completado

### Infraestructura
- [x] `api.ventatalk.com` y `admin.ventatalk.com` con SSL
- [x] `.env.development` / `.env.production` separados
- [x] GitHub Actions deploy automático (ventatalk + ventatalk-web + ventatalk-admin)
- [x] git stash en deploy + permisos .git corregidos
- [x] Swap 2GB + mem_limit 1.5g frontend
- [x] Deploy timeout aumentado a 18 minutos

### Backend
- [x] Migración 006 — billing, features, channel en DB
- [x] Migración 007 — tablas orders y coupons
- [x] Sistema de features por plan (PLAN_FEATURES)
- [x] Billing refactorizado — MAX plan, billing anual, webhooks Stripe
- [x] Contador conversaciones + reset mensual Celery
- [x] Verificación límites por plan antes de responder IA
- [x] Endpoints admin (/api/v1/admin/*)
- [x] Endpoints órdenes y cupones WooCommerce
- [x] DELETE /catalog/source/{name}
- [x] PATCH /catalog/{id}/toggle
- [x] GET /catalog con image_url, stock_quantity, sku
- [x] GET /business/orders paginado con filtros
- [x] GET /business/coupons paginado con filtros
- [x] Rate limiter — 30 req/min + OPTIONS excluido

### Frontend app.ventatalk.com
- [x] Login, Register, Reset Password (diseño Claude Design)
- [x] Conversaciones — layout estilo WhatsApp Web
- [x] Tracking links 1.0 en panel de conversaciones (botón "Links" + modal + lista con copy + badge de conversiones)
- [x] Sección Ecommerce: Productos, Órdenes, Cupones
- [x] Productos — thumbnail, SKU, stock, toggle is_available, paginación
- [x] Órdenes — tabla con filtros, paginación, modal detalle
- [x] Cupones — tabla con filtros, paginación, modal detalle
- [x] Settings — delete catalog source con confirmación
- [x] Sidebar — sección Ecommerce agregada
- [x] ThemeProvider forzado a light

### Plugin WordPress (v1.1.0)
- [x] Rename ventabot → ventatalk
- [x] Sync tiempo real productos (hooks WooCommerce)
- [x] Sync tiempo real órdenes (hooks new_order + status_changed)
- [x] Sync tiempo real cupones (hook coupon_options_save)
- [x] Sync manual — productos + órdenes + cupones en un solo click
- [x] Payload completo: image_url, stock_quantity, sku

### Admin panel
- [x] Repo ventatalk-admin creado y desplegado
- [x] Login funcional
- [x] Dashboard stats, lista clientes, detalle cliente (MVP)
- [x] Smoke test end-to-end admin.ventatalk.com (login → dashboard → lista → detalle → edición plan/features)
- [x] Fix tipos `Business` alineados con shape backend (items vs data, is_active vs status, features Record<string,boolean>, integrations string[])