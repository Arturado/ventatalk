# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Mayo 2026

---

## 🔴 P0 — Crítico

- [ ] **Verificar admin.ventatalk.com completo** — login → dashboard → lista clientes → detalle cliente
  - Middleware corregido (proxy.ts → middleware.ts), pendiente verificar flujo completo end to end

---

## 🟠 P1 — Alta prioridad

- [ ] **Rediseño completo `app.ventatalk.com`** con Claude Design
  - Pantallas pendientes: dashboard overview, contactos, leads, integraciones, settings
  - Login, Register, Reset Password, Conversaciones ya implementados con Claude Design
  - Flujo: Claude Design → handoff → Claude Code → integrar con API existente

- [ ] **Rediseño `admin.ventatalk.com`** con Claude Design
  - Backend ya implementado, solo refinar el frontend

---

## 🟡 P2 — Media prioridad

- [ ] **Módulo carritos abandonados**
  - El agente detecta consultas de compra sin completar
  - Enviar follow-up automático vía WhatsApp (extender Celery beat)
  - Disponible en todos los planes

- [ ] **Módulo Reviews**
  - El agente solicita reseña al finalizar conversación/compra
  - Redirige a Google Maps u otro según config del tenant
  - Plan Pro y MAX

- [ ] **Conversion tracking frontend**
  - Backend ya genera tokens y registra conversiones ✅
  - Falta: UI en conversaciones para generar y ver links de tracking
  - Dashboard de conversiones en analytics

- [ ] **GitHub Actions para `ventatalk-admin`**
  - Falta agregar deploy key al repo de GitHub
  - Workflow ya existe en `.github/workflows/deploy.yml`

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
