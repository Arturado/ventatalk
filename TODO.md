# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Junio 2026

---

## 🔴 P0 — Crítico (post-reconstrucción)

- [x] Verificar push del fix de gitleaks (commit `02bc907`) — confirmado en origin/main

- [x] Sincronizar `.env.development` local con producción

- [x] Configurar Stripe Webhook en panel — endpoint + 3 eventos creados
  - [ ] **Falta confirmar:** restart de api+worker+beat tras agregar `STRIPE_WEBHOOK_SECRET` (valor ya está correcto en `.env.production`)

- [x] **WhatsApp multi-cliente — Embedded Signup implementado** ✅ (Junio 2026)
  - Backend: `POST /api/v1/integrations/whatsapp/connect` — intercambia code → token Meta, obtiene WABA + phone numbers, suscribe webhooks, upsert en `phone_numbers`
  - Backend: `GET /api/v1/integrations/whatsapp/status` + `DELETE /api/v1/integrations/whatsapp/{id}`
  - Frontend: card "WhatsApp Business" en `/dashboard/integrations` con FB SDK Embedded Signup (postMessage + FB.login)
  - Vars: `META_APP_ID`, `META_CONFIG_ID` en backend; `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` como build args en Dockerfile/docker-compose.prod.yml
  - [ ] **Pendiente configuración en Meta** (hace el operador, no Claude):
    - Facebook Login for Business → Allowed Domains: `https://app.ventatalk.com`
    - Crear Configuración con permisos `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management` → guardar `META_CONFIG_ID`
    - Iniciar Business Verification + App Review (Advanced Access) en Meta
    - App debe estar en modo **Live** para externos (hoy: Development)
  - [ ] **Testing end-to-end**: completar flujo desde `app.ventatalk.com`, verificar fila en `phone_numbers`, probar mensajería

- [x] **Regenerar tokens Meta WhatsApp (sandbox)** — ✅ completado
  - System User permanente creado (`ventatalk-sandbox-bot`), token no expira
  - `WA_TEST_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_API_VERSION=v25.0`, `WA_TEST_PHONE_NUMBER_ID` actualizados en `.env.production`
  - Webhook corregido: URL era `app.ventatalk.com/webhook` (frontend, mal) → `api.ventatalk.com/webhook` (correcto)
  - Número sandbox registrado manualmente en tabla `phone_numbers` (business: VentaTalk Admin Demo)
  - **Probado end-to-end**: bot responde en WhatsApp ✅

- [ ] **Re-onboarding clientes piloto** (catálogo — independiente de WhatsApp, puede avanzar en paralelo)
  - **MP Cars** — desinstalado, requiere: mejorar plugin visualmente (v1.2.0) + reconectar (usuario, token, reimportar 539 productos/49 órdenes)
  - **Clínica cosmética** — WordPress: regenerar token, instalar plugin v1.2.0 — pendiente
  - **Pace Coffee Roasters** — Jumpseller: nuevas API credentials — pendiente

---

## 🟠 P1 — Alta prioridad

- [x] **Dependabot — RESUELTO** ✅
  - Alertas de seguridad + security updates activados en los 3 repos
  - `dependabot.yml` agregado (pip/npm/docker/github-actions) — ya generó PRs de actualización
  - ⚠️ Pendiente: triage de 39 vulnerabilidades reportadas en `ventatalk` (1 critical, 17 high, 17 moderate, 4 low) — revisar cuáles son de prod vs dev

- [ ] **Backups automáticos de DB**
  - cron + `pg_dump` → almacenamiento externo (S3, Donweb backup, o R2)
  - Frecuencia mínima: diario, retención 7 días local + 30 externo

- [x] **GitHub Actions deploy — RESUELTO** ✅
  - Causa: `VPS_SSH_KEY` en GitHub Secrets ya no era válida tras el hardening del VPS (handshake failed: unable to authenticate)
  - Fix: nueva keypair dedicada (`~/.ssh/gh_actions_deploy`), pública agregada a `authorized_keys` de `hanowar`, privada actualizada en `VPS_SSH_KEY` de los 3 repos
  - Los 3 repos (ventatalk, ventatalk-web, ventatalk-admin) ya despliegan automáticamente en push a main

- [ ] **Migrar `ventatalk-web` de Next 14.2.29 → 15.x**
  - Branch 14 ya no recibe parches de seguridad

- [ ] **`npm audit fix` en `frontend`**
  - 4 vulnerabilidades menores (3 moderate, 1 high)

- [ ] **Plugin WordPress v1.2.0** — mejora visual + `product_url` (combina con Tracking 2.0 Fase 2b)

- [ ] **Rediseño completo `app.ventatalk.com`** con Claude Design

- [ ] **Rediseño `admin.ventatalk.com`** con Claude Design

---

## 🟡 P2 — Media prioridad

- [ ] **Tracking 2.0 — continuar desde Fase 2b**
  - Fase 1, 2a, 2a.1 ✅
  - Fase 2b: WooCommerce plugin v1.2.0 con `product_url`
  - Fase 2c: Shopify backfill | 2d: Bsale → NULL | 2e: MercadoLibre backfill
  - Fase 3: endpoint tracking-link con `catalog_item_id`
  - Fase 4: Plugin WordPress v1.3.0 conversion tracking + Pixel JS
  - Fase 5: UI catálogo column + conversations selector
  - Fase 6: Domain override por cliente

- [ ] **Módulo carritos abandonados** — follow-up WhatsApp vía Celery beat, todos los planes

- [ ] **Módulo Reviews** — Plan Pro y MAX

- [ ] **Conversion tracking frontend** — backend ✅, falta UI + `/analytics/conversions`

- [ ] **Órdenes y Cupones — otras integraciones** — WooCommerce ✅, Jumpseller/Bsale/Shopify/MercadoLibre pendientes

---

## 🔵 P3 — Backlog

- [ ] Canal Instagram DM (add-on $20)
- [ ] Módulo B2B / Cotizaciones (Plan MAX)
- [ ] Campañas outbound / WhatsApp Marketing (Plan Pro+)
- [ ] Crear cupones desde VentaTalk
- [ ] Bsale bulk price list — fix precios faltantes por variante
- [ ] Shopify, MercadoLibre — sin cliente activo todavía

---

## ⚙️ Deuda Técnica

- [~] OOM frontend — mem_limit 1.5g + swap 2GB aplicados. Revisado jun 2026: sin evidencia de problema actual (35MB/1.5GB, sin OOM kills en dmesg, swap casi sin uso). Re-chequear en unos días con `docker stats --no-stream` para confirmar si el leak gradual sigue existiendo
- [ ] Pipeline status visible en conversaciones
- [ ] Optimización embeddings — batch processing
- [ ] Tests — no hay tests automatizados
- [x] Logrotate — configurado en `/etc/logrotate.d/docker-containers` (50MB max, 5 rotaciones, diario vía systemd timer)
- [x] Monitoreo proactivo — UptimeRobot activo (4 monitores: landing, app, api, admin), alertas por email

---

## ✅ Completado en esta iteración

- [x] Stripe webhook endpoint + eventos configurados en panel
- [x] Auditoría de seguridad git (gitleaks) — commit `02bc907` confirmado en origin/main
- [x] `.env.development` sincronizado con producción
- [x] Meta WhatsApp sandbox — token permanente + webhook funcionando end-to-end
- [x] GitHub Actions deploy reparado en los 3 repos (nueva SSH key)
- [x] Dependabot activo en los 3 repos
- [x] Fix: `beat` ya no entra en loop por pidfile viejo (`rm -f` antes de iniciar)
- [x] Fix: healthcheck de `db` hardcodeado (`pg_isready -U ventatalk -d ventatalk_db`) — ya no ensucia logs

---

## 📝 Aprendizajes nuevos (junio 2026)

- **Cada número WhatsApp requiere fila en `phone_numbers`** (business_id, phone_number_id, access_token, waba_id) — sin esto el `message_processor` ignora mensajes con "phone_number_id no registrado". Esto es lo que el flujo de Embedded Signup (item P0 arriba) debe automatizar
- **`phone_numbers.access_token` se guarda en texto plano** (sin Fernet), a diferencia de `business.integrations`
- **Webhook callback URL debe ser `api.ventatalk.com`**, no `app.ventatalk.com` — el frontend no tiene ruta `/webhook`
- **WhatsApp API version actual: v25.0** (estaba en v19.0, desactualizada)

---

## ✅ Completado — reconstrucción VPS (mayo 2026)

Ver historial previo: hardening VPS, Docker stack, Nginx 4 server blocks, 8 migraciones aplicadas, seed businesses, Next.js 15.5.18, credenciales rotadas, POSTGRES_USER renombrado, panel admin MVP, plugin WordPress v1.1.0, migración arturodev.info.