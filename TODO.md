# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Mayo 2026

---

## 🔴 P0 — Crítico (hacer ahora)

- [ ] **Verificar admin.ventatalk.com completo** — login → dashboard → lista clientes → detalle cliente
  - Bug conocido: middleware corregido (proxy.ts → middleware.ts), pendiente verificar flujo completo
  - Verificar que las llamadas a `/api/v1/admin/*` funcionan con token JWT

---

## 🟠 P1 — Alta prioridad

- [ ] **Rediseño completo `app.ventatalk.com`** con Claude Design
  - Pantallas: dashboard overview, conversaciones, contactos, leads, integraciones, settings
  - Objetivo: mejor UX/UI + reorganización de secciones
  - Flujo: Claude Design → handoff → Claude Code → integrar con API existente

- [ ] **Rediseño `admin.ventatalk.com`** con Claude Design
  - Pantallas: dashboard stats, lista clientes, detalle cliente
  - El backend ya está implementado, solo refinar el frontend

---

## 🟡 P2 — Media prioridad

- [ ] **Módulo carritos abandonados**
  - El agente detecta consultas de compra sin completar
  - Envía follow-up automático vía WhatsApp (extender Celery beat existente)
  - Disponible en todos los planes

- [ ] **Módulo Reviews**
  - El agente solicita reseña al finalizar conversación/compra
  - Redirige a Google Maps u otro según config del tenant
  - Disponible en Plan Pro y MAX

- [ ] **Conversion tracking frontend**
  - El backend ya genera tokens y registra conversiones
  - Falta: UI en conversaciones para generar y ver links de tracking
  - Dashboard de conversiones en analytics

- [ ] **GitHub Actions para `ventatalk-admin`**
  - Falta: agregar deploy key al repo de GitHub
  - El workflow ya existe en `.github/workflows/deploy.yml`

---

## 🔵 P3 — Backlog

- [ ] **Canal Instagram DM** (add-on $20)
  - Stack: Meta Graph API + permiso `instagram_manage_messages`
  - Requiere review de Meta para producción
  - CRM unificado con filtro por canal

- [ ] **Módulo B2B / Cotizaciones** (Plan MAX)
  - Agente genera cotizaciones formales (PDF/email) o responde precios por WhatsApp
  - Cliente elige modalidad desde su dashboard

- [ ] **Campañas outbound / WhatsApp Marketing** (Plan Pro+)
  - Envío a contactos del CRM
  - IMPORTANTE: solo con templates aprobados por Meta
  - Evaluar antes: integración Mailchimp vs servicio propio

- [ ] **Bsale bulk price list**
  - Fix precios faltantes — reemplazar llamadas por variante con bulk fetch
  - Actualmente hay productos sin precio en el catálogo

- [ ] **Límite de productos Bsale dinámico por plan**
  - Actualmente hardcodeado en 500
  - Debería variar según plan del tenant

- [ ] **Integración Shopify** (ya implementada en backend, sin cliente activo)

- [ ] **MercadoLibre** (add-on $150, ya implementado en backend)

---

## ⚙️ Deuda Técnica

- [ ] **Renombrar en código** `VentaBot` → `VentaTalk` en cualquier referencia que quede
- [ ] **Pipeline status** visible en conversaciones (mostrar etapa del lead dentro del chat)
- [ ] **Monitoreo OOM frontend** — mem_limit 1.5g + swap 2GB aplicados, verificar que no vuelva a caer
- [ ] **Optimización embeddings** — batch processing para reducir costos OpenAI
- [ ] **Tests** — no hay tests automatizados, añadir al menos tests de endpoints críticos

---

## ✅ Completado

- [x] P0: `api.ventatalk.com` con SSL
- [x] P0: `admin.ventatalk.com` con SSL y noindex
- [x] P0: Frontend apuntando a `api.ventatalk.com`
- [x] P0: `.env.development` / `.env.production` separados
- [x] P1: Migración 006 — billing, features, channel en DB
- [x] P1: Sistema de features por plan (`PLAN_FEATURES`)
- [x] P1: Billing refactorizado — MAX plan, billing anual, webhooks Stripe completos
- [x] P1: Contador de conversaciones por hilo
- [x] P1: Reset mensual con Celery beat
- [x] P1: Verificación de límites por plan antes de responder
- [x] P2: GitHub Actions deploy automático (ventatalk + ventatalk-web + ventatalk-admin)
- [x] P2: Plugin WordPress — rename, sync tiempo real, widget toggle
- [x] P2: Tracking URL fix — usa `API_URL`
- [x] P2: Repo `ventatalk-admin` creado y desplegado
- [x] P2: Backend endpoints admin (`/api/v1/admin/*`)
- [x] P2: Frontend admin MVP (login, dashboard, clientes)
- [x] Fix: Rate limiter — 30 req/min + OPTIONS excluido
- [x] Fix: Swap 2GB + mem_limit 1.5g para frontend
- [x] Fix: git stash en deploy workflow
- [x] Fix: Permisos `.git` en VPS
- [x] Fix: VentaBot → VentaTalk en logs y Swagger
- [x] Fix: `env: production` en producción
- [x] Fix: Git remote SSH en todos los repos del VPS
