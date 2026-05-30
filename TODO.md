# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Mayo 2026 (post-reconstrucción VPS + migración arturodev.info)

---

## 🔴 P0 — Crítico (post-reconstrucción)

- [ ] **Sincronizar `.env.development` local con producción**
  - POSTGRES_USER=ventatalk (era ventabot)
  - POSTGRES_DB=ventatalk_db (era ventabot_db)
  - WIDGET_BUSINESS_ID=ac239145-a993-4661-9287-341c0ed91e40 (nuevo)
  - Validar que Docker local levanta sin problemas

- [ ] **Configurar Stripe Webhook en panel + secret en `.env.production`**
  - Endpoint: `https://api.ventatalk.com/api/v1/billing/webhook`
  - Eventos: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
  - Copiar `whsec_...` a STRIPE_WEBHOOK_SECRET y restartear api+worker+beat

- [ ] **Regenerar tokens Meta WhatsApp (sandbox)**
  - Pedirle a developers.facebook.com nuevo Access Token
  - Actualizar WA_TEST_ACCESS_TOKEN y META_APP_SECRET en `.env.production`

- [ ] **Re-onboarding clientes piloto** (cuando se contacte con cada uno)
  - **Pace Coffee Roasters (NathalieSPA)** — Jumpseller: pedir nuevas API credentials
  - **Clínica cosmética** — WordPress: regenerar token del plugin, instalar v1.1.0
  - **MP Cars (Repuestos automotriz)** — WordPress: regenerar token + reinstalar plugin

---

## 🟠 P1 — Alta prioridad

- [ ] **Backups automáticos de DB**
  - cron + `pg_dump` → almacenamiento externo (S3, Donweb backup, o R2)
  - Frecuencia mínima: diario
  - Retención: 7 días local + 30 días externo

- [ ] **Dependabot/Renovate** en los 3 repos
  - Alertas automáticas de CVE en dependencias
  - El bug de Next.js 15.0.3 hubiera sido alertado meses antes

- [ ] **Verificar GitHub Actions deploy** con las nuevas deploy keys
  - Las 3 keys nuevas están en `~/.ssh/deploy_keys/` del VPS (read-only)
  - Workflows ya existen pero pueden tener referencias a keys viejas en GitHub Secrets
  - Probar push de prueba en cada repo

- [ ] **Migrar `ventatalk-web` de Next 14.2.29 → 15.x**
  - Branch 14 ya no recibe parches de seguridad (Vercel lo anunció)
  - Es solo la landing, migración debe ser limpia

- [ ] **`npm audit fix` en `frontend`**
  - 4 vulnerabilidades menores (3 moderate, 1 high) reportadas durante upgrade a Next 15.5.18
  - Validar que `--force` no rompa el build

- [ ] **Rediseño completo `app.ventatalk.com`** con Claude Design
  - Pantallas pendientes: dashboard overview, contactos, leads, integraciones, settings
  - Login, Register, Reset Password, Conversaciones ya implementados con Claude Design

- [ ] **Rediseño `admin.ventatalk.com`** con Claude Design
  - Backend ya implementado, solo refinar el frontend

---

## 🟡 P2 — Media prioridad

- [ ] **Tracking 2.0 — continuar desde Fase 2b**
  - Fase 1 ✅ (campo `product_url` en catalog_items, migración 008)
  - Fase 2a ✅ (Jumpseller backfill `product_url`)
  - Fase 2a.1 ✅ (auto-detect URL prefix Jumpseller)
  - Fase 2b: WooCommerce plugin v1.2.0 con `product_url`
  - Fase 2c: Shopify backfill
  - Fase 2d: Bsale → NULL (no expone permalinks)
  - Fase 2e: MercadoLibre backfill
  - Fase 3: Nuevo endpoint tracking-link con `catalog_item_id`
  - Fase 4: Plugin WordPress v1.3.0 conversion tracking + Pixel JS
  - Fase 5: UI catálogo column + conversations selector
  - Fase 6: Domain override por cliente

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
  - Dashboard de conversiones en analytics (`/analytics/conversions`)

- [ ] **Órdenes y Cupones — otras integraciones**
  - WooCommerce ✅ implementado
  - Jumpseller, Bsale, Shopify, MercadoLibre pendientes

---

## 🔵 P3 — Backlog

- [ ] **Canal Instagram DM** (add-on $20)
- [ ] **Módulo B2B / Cotizaciones** (Plan MAX)
- [ ] **Campañas outbound / WhatsApp Marketing** (Plan Pro+) — solo templates Meta
- [ ] **Crear cupones desde VentaTalk** (actualmente solo visualización)
- [ ] **Bsale bulk price list** — fix precios faltantes por variante
- [ ] **Shopify, MercadoLibre** — sin cliente activo todavía

---

## ⚙️ Deuda Técnica

- [ ] **OOM frontend** — mem_limit 1.5g + swap 2GB aplicados, monitorear
- [ ] **Pipeline status** visible en conversaciones
- [ ] **Optimización embeddings** — batch processing para reducir costos OpenAI
- [ ] **Tests** — no hay tests automatizados
- [ ] **Logrotate** — los logs de containers van a llenar disco a largo plazo
- [ ] **Monitoreo proactivo** — UptimeRobot o similar para los 4 subdominios

---

## ✅ Completado en esta iteración (reconstrucción VPS post-hack)

### Infraestructura nueva (mayo 2026)
- [x] VPS recreado en Donweb (misma IP `179.43.124.82`)
- [x] Hardening completo: SSH puerto 5743 only, root deshabilitado, password auth off, UFW + Fail2ban, Donweb edge firewall
- [x] Usuario non-root `hanowar` con sudo, key-only auth
- [x] Swap 2GB persistente en `/etc/fstab`
- [x] Timezone UTC + NTP
- [x] `/etc/apt/apt.conf.d/52ventatalk-no-reboot` para deshabilitar Automatic-Reboot

### Stack base
- [x] Docker 29.5.0 + Compose v5.1.3 (oficial Docker, no Ubuntu repos)
- [x] Nginx 1.18.0 + Certbot snap
- [x] Cert SSL multi-SAN (ventatalk.com, www, app, api, admin) — auto-renew

### Seguridad de containers (lecciones del hack)
- [x] **Next.js 15.0.3 → 15.5.18** en frontend (CVE parchada)
- [x] **Dockerfile frontend** con USER node + chown
- [x] **Dockerfile backend** multi-stage + USER ventatalk (sin gcc en runtime, ~250MB)
- [x] **Dockerfile ventatalk-web** con chown -R + USER node
- [x] **Dockerfile ventatalk-admin** con USER node
- [x] **`.gitignore`** de ventatalk-web actualizado (ignora `.env.production`)

### Nginx
- [x] 4 server blocks separados en `sites-available/` (uno por subdominio)
- [x] HTTP→HTTPS redirect en cada block
- [x] `admin.ventatalk.com` con `X-Robots-Tag: noindex, nofollow`
- [x] `api.ventatalk.com` con timeout 300s + body 50M
- [x] Sintaxis nginx 1.18 (`listen 443 ssl http2;` inline, no `http2 on;` separado)
- [x] `default` y `default.bak` removidos de sites-enabled

### Containers operativos
- [x] 8 containers running (api, worker, beat, frontend, web, admin, db, redis)
- [x] Beat con volume `celery_beat_data` para schedule persistente
- [x] Healthchecks frontend/admin con `127.0.0.1` (no `localhost`, busybox IPv6 issue)
- [x] Las 8 migraciones aplicadas (001 → 008_catalog_product_url)

### Bootstrap mínimo
- [x] `admin@ventatalk.com` creado → UUID `67546dec-9b0b-49a1-ae38-d2db96312310`
- [x] `widget@ventatalk.com` creado → UUID `ac239145-a993-4661-9287-341c0ed91e40`
- [x] `WIDGET_BUSINESS_ID` actualizado en `.env.production`
- [x] Smoke test: login admin → ver lista 2 clientes funcionando

### Credenciales rotadas
- [x] SECRET_KEY, FERNET_KEY, POSTGRES_PASSWORD (locales generadas con openssl)
- [x] OPENAI_API_KEY (rotada en panel)
- [x] STRIPE_SECRET_KEY (rolled en panel)
- [x] META_VERIFY_TOKEN (nuevo openssl hex)
- [x] Passwords admin + widget (strong random)

### POSTGRES_USER renombrado
- [x] `ventabot` → `ventatalk` (clean break desde DB nueva)

---

## ✅ Completado antes de la reconstrucción (mantenido)

### Backend
- [x] Migraciones 001 → 008 (incluye billing, features, channel, orders, coupons, product_url)
- [x] Sistema de features por plan (PLAN_FEATURES)
- [x] Billing refactorizado — MAX plan, billing anual, webhooks Stripe
- [x] Contador conversaciones + reset mensual Celery
- [x] Verificación límites por plan antes de responder IA
- [x] Endpoints admin (/api/v1/admin/*)
- [x] Endpoints órdenes y cupones WooCommerce
- [x] CRUD catálogo completo (toggle, delete source, image_url, stock, sku)
- [x] GET /business/orders y /coupons paginado con filtros
- [x] Rate limiter — 30 req/min + OPTIONS excluido
- [x] Jumpseller Tracking 2.0 Fase 2a + 2a.1 (auto-detect URL prefix)

### Frontend app.ventatalk.com
- [x] Login, Register, Reset Password (diseño Claude Design)
- [x] Conversaciones — layout estilo WhatsApp Web
- [x] Sección Ecommerce: Productos, Órdenes, Cupones (tabla, filtros, paginación)
- [x] Settings — delete catalog source con confirmación
- [x] Sidebar — sección Ecommerce agregada
- [x] ThemeProvider forzado a light

### Plugin WordPress (v1.1.0)
- [x] Rename ventabot → ventatalk
- [x] Sync tiempo real productos/órdenes/cupones (hooks WooCommerce)
- [x] Sync manual unificado
- [x] Payload completo: image_url, stock_quantity, sku

### Admin panel (ventatalk-admin)
- [x] Repo creado y desplegado
- [x] Login funcional + dashboard stats + lista clientes + detalle (MVP)
- [x] Smoke test end-to-end
- [x] Fix tipos `Business` alineados con shape backend

---

## ✅ Completado — Migración arturodev.info al VPS (mayo 2026)

- [x] Portfolio `arturodev.info` migrado al VPS de VentaTalk sin conflictos (puertos 3010/4010)
- [x] `docker-compose.prod.yml` creado (frontend :3010, backend :4010, postgres sin exponer al host)
- [x] GitHub Actions workflow migrado de PM2/NVM → Docker Compose
- [x] Deploy key `arturodev_deploy` configurada (pub en GitHub repo + pub en VPS `authorized_keys`)
- [x] SSL para `arturodev.info`, `www.arturodev.info`, `api.arturodev.info` (Certbot, expira 2026-08-26)
- [x] Nginx server blocks activos para los 2 dominios
- [x] Migración Prisma para tablas `User`, `Experience`, `Config` (faltaban en migración inicial)
- [x] Migración failed (P3009) resuelta con UPDATE en `_prisma_migrations`
- [x] Usuario admin creado en `hola@arturodev.info`
- [x] GitHub Actions deploy automático funcionando
- [x] Cloudflare DNS apuntando a `179.43.124.82`, proxy naranja activo, SSL mode Full
