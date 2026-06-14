# VentaTalk — TODO Priorizado

> Actualizar cuando se completa una tarea o cambia la prioridad.
> Última actualización: Junio 2026

---

## 🔴 P0 — Crítico (post-reconstrucción)

- [x] Verificar push del fix de gitleaks (commit `02bc907`) — confirmado en origin/main

- [x] Sincronizar `.env.development` local con producción

- [x] Configurar Stripe Webhook en panel — endpoint + 3 eventos creados
  - [ ] **Falta confirmar:** restart de api+worker+beat tras agregar `STRIPE_WEBHOOK_SECRET` (valor ya está correcto en `.env.production`)

- [ ] **WhatsApp multi-cliente — Embedded Signup / Tech Provider** ⚠️ NUEVO, BLOCKER
  - Hoy el sandbox solo soporta 1 WABA (el de prueba de VentaTalk). Para que un cliente real (MP Cars, clínica, Pace Coffee) reciba mensajes vía VentaTalk, necesita su propio número de WhatsApp Business conectado a la App de Meta de VentaTalk
  - Requiere flujo "Convertirte en proveedor de tecnología" (Embedded Signup) en Meta for Developers
  - Backend: `webhook.py` debe enrutar mensajes entrantes por `phone_number_id` → `business_id` (actualmente asume 1 solo número)
  - Modelo `PhoneNumber` ya existe (multi-tenant por diseño) — falta el flujo de conexión + routing
  - **Sin esto, "Re-onboarding clientes piloto" no tiene sentido completo**: pueden tener catálogo sincronizado pero no recibir WhatsApp real

- [x] **Regenerar tokens Meta WhatsApp (sandbox)** — ✅ completado
  - System User permanente creado (`ventatalk-sandbox-bot`), token no expira
  - `WA_TEST_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_API_VERSION=v25.0`, `WA_TEST_PHONE_NUMBER_ID` actualizados en `.env.production`
  - Webhook corregido: URL era `app.ventatalk.com/webhook` (frontend, mal) → `api.ventatalk.com/webhook` (correcto)
  - Número sandbox registrado manualmente en tabla `phone_numbers` (business: VentaTalk Admin Demo)
  - **Probado end-to-end**: bot responde en WhatsApp ✅

- [ ] **Re-onboarding clientes piloto** (catálogo — independiente de WhatsApp, puede avanzar en paralelo)
  - **MP Cars** — desinstalado, requiere: mejorar plugin visualmente (v1.2.0) + reconectar (usuario, token, reimportar 539 productos/49 órdenes)
  - **Clínica cosmética** — WordPress: regenerar token, instalar plugin v1.2.0 — pendiente
  - [x] **Pace Coffee Roasters** — Jumpseller RESUELTO ✅ — reconectado desde dashboard VentaTalk, token actualizado, 15 productos sincronizados (13 jun)

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
  - Intento jun 2026: test del endpoint /whatsapp/connect con mocks de Graph API. Happy path PASÓ (valida exchange→WABA→phone_numbers→upsert correcto). Pero conftest.py requiere reescritura (NullPool, fixtures con commit explícito, teardown FK entre phone_numbers/businesses) — cambio grande a infra compartida, descartado por falta de tiempo para validar contra toda la suite. Retomar en sesión dedicada: reescribir conftest + correr suite completa antes de commitear.
- [x] Logrotate — configurado en `/etc/logrotate.d/docker-containers` (50MB max, 5 rotaciones, diario vía systemd timer)
- [x] Monitoreo proactivo — UptimeRobot activo (4 monitores: landing, app, api, admin), alertas por email

---

## ✅ WhatsApp Embedded Signup — IMPLEMENTADO Y DESPLEGADO (jun 2026)

- [x] Backend: POST/GET/DELETE /api/v1/integrations/whatsapp/{connect,status,disconnect}
- [x] Frontend: card "WhatsApp Business" en /dashboard/integrations con FB JS SDK
- [x] Fix: callback de FB.login debe ser sync (no async) — SDK hace type-check estricto
- [x] CI: --env-file .env.production agregado al deploy script
- [x] Validado en producción: GET /status lee correctamente el sandbox existente
- [x] Validado: SDK carga, popup de Meta abre, config_id y permisos correctos
- [x] Validado (test con mocks): lógica de /connect correcta (exchange→WABA→upsert)
- [ ] **BLOQUEADO por Meta**: completar conexión real requiere Advanced Access (App Review) — mensaje exacto: "La app de socio no tiene los permisos avanzados de mensajes y administración de WhatsApp Business necesarios para el registro"
- [ ] Próxima semana: completar Tech Provider + Business Verification (docs legales VentaTalk) → desbloquea App Review → probar conexión real con WABA externo (ej. número personal de Hanowar como WhatsApp oficial de VentaTalk, o piloto real)

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

---

## 💡 Ideas / Plan B (sin compromiso aún)

- **WhatsApp no oficial (tipo Kommo "WhatsApp Lite", Baileys/whatsapp-web.js)** — conexión vía QR, sin App Review de Meta, funciona en minutos. Riesgo: viola ToS de WhatsApp, Meta banea números con patrones de automatización. Considerar SOLO como demo desechable para prospects que quieren ver algo funcionando antes de comprometerse — NUNCA para el WhatsApp principal de un piloto real. Plan A (Cloud API oficial) sigue siendo el camino correcto y ya está ~90% construido, solo falta aprobación de Meta.

---

## ✅ Dependabot — RESUELTO (jun 2026)

- [x] axios 1.14.0 → 1.17.0 (frontend) — ~22 alertas High resueltas
- [x] python-jose 3.3.0 → 3.5.0 (Critical) — algoritmo ya estaba pineado explícito en jwt.decode, riesgo real era bajo
- [x] python-multipart 0.0.12 → 0.0.32 (High)
- [x] langchain ecosystem 0.3.9 → 0.3.30 + pins core/text-splitters (High, XXE)
- [x] cryptography 43.0.3 → 44.0.3 (High)
- [x] Deploy automático OK + smoke test en sandbox WhatsApp: bot responde correctamente sobre catálogo Y mantiene guardrails ante intento de desvío de tema — bump de langchain validado sin regresiones
- Restante: ~2 moderate postcss/next (requiere downgrade de Next.js, no viable) + ~2 low sin prioridad

**Triage original (referencia):**

1. **axios → última major version** (frontend) — resuelve ~15 alertas de un golpe (prototype pollution, ReDoS, SSRF, header injection, etc). Correr build + tests del frontend después.
2. **python-jose** (🔴 CRITICAL — algorithm confusion con claves ECDSA) — backend/auth. PRIMERO revisar si `jwt.decode()` ya fija `algorithms=["HS256"]` explícitamente (si sí, riesgo real es bajo pero igual actualizar versión). Si no está fijado, es el fix más urgente de los 39.
3. **python-multipart** (🟠 High — arbitrary file write + DoS headers) — revisar endpoints de upload de archivos/imágenes de catálogo.
4. **langchain-community** (🟠 High — XXE) — confirmar si se usa activamente o es dependencia transitiva sin uso real (¿se importa en algún lado?).
5. **cryptography** (🟠 High — SECT curves) — update de versión, bajo riesgo de breaking changes.

**No urgente / bajo riesgo:**
- `pytest` tmpdir — dependencia de dev, no afecta producción
- Resto de axios Moderate/Low — se resuelven con el update del punto 1
- `python-dotenv`, `cryptography` OpenSSL Low

Combinar con el ítem existente "npm audit fix en frontend" — mismo trabajo, una sola sesión.

---

## 🔒 Refinamiento — Validación de dominio v2 (post v1.2.0)

**Estado actual (v1.2.0)**: `_check_and_lock_site_url` es "first-come-first-served" — el primer `site_url` que use el token queda bloqueado como válido. Previene cambios accidentales de dominio, pero NO valida que el dominio sea legítimamente del negocio (si el token se filtra/comparte, simplemente se ata al primer sitio que lo use, sin alerta).

**Mejora propuesta**: agregar campo "Sitio web oficial" en el perfil del negocio (VentaTalk Dashboard → Configuración/Perfil), declarado por el cliente al registrarse o en cualquier momento. `/verify` y la validación de ingest deberían comparar `site_url` entrante contra ESTE valor pre-registrado (no contra "lo que llegue primero"). Si no coincide → rechazar SIEMPRE, incluso en "primera conexión".

Implica:
- Campo nuevo en `businesses` o `integrations` (dashboard UI + backend)
- Cambiar lógica de `_check_and_lock_site_url`: ya no "lock on first use", sino "compare against registered value" (con fallback: si el campo está vacío, mantener comportamiento actual de v1.2.0 como transición)
- Onboarding: pedir el sitio web del negocio se vuelve un paso explícito

## 💡 Idea — Widget de Chat Web (nuevo, no especificado aún)

El plugin v1.2.0 ya muestra un selector "Tipo de widget: WhatsApp / Chat Web (Próximamente)". Chat Web = widget embebible de chat directo en el navegador (sin redirigir a WhatsApp), con su propio backend de conversaciones para visitantes anónimos del sitio. Feature nueva y de tamaño considerable (comparable a WhatsApp Embedded Signup) — requiere spec propia en sesión dedicada: diseño del widget embebible, modelo de conversaciones para visitantes web (vs contactos de WhatsApp), backend endpoint, identidad/sesión de visitantes anónimos.

---

## 🔴 PENDIENTE — Deploy v1.2.0 backend no llegó a producción (rate limit Docker Hub)

**Diagnóstico completo (jun 2026, madrugada)**:
- Código correcto en VPS filesystem (`~/ventatalk/backend/app/api/v1/endpoints/integrations.py` línea 661 tiene `/woocommerce/verify`)
- Endpoint NO existe en `/api.ventatalk.com/openapi.json` ni en el container `api` corriendo — la imagen Docker nunca se reconstruyó con este código (ni el commit de v1.2.0 ni el fix de normalización llegaron al container, aunque CI mostró ✅ verde en ambos — investigar por qué CI no detectó el fallo)
- `docker compose build --no-cache api` falla con 429 Too Many Requests de Docker Hub (`python:3.12-slim`)
- `up -d api` sin rebuild no hace nada (container sigue con imagen vieja)

**Para retomar (mañana)**:
1. Opción rápida: `docker login` en el VPS (sube el límite de pulls de 100 a 200/6h) — `docker login -u <usuario_dockerhub>` con cuenta gratuita
2. O esperar el reset del rate limit (unas horas) y reintentar
3. Una vez el build pase sin 429: `docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache api && up -d api`
4. Verificar: `curl -s https://api.ventatalk.com/openapi.json | grep -o '"woocommerce/verify"'` debe aparecer
5. Re-probar en MP Cars: WP-Admin → VentaTalk → Configuración → borrar y repegar token → debería mostrar "✅ Dominio verificado" y desaparecer el banner "ERROR DE CONFIGURACIÓN"
6. **Investigar por qué CI marcó ✅ verde** en los 2 deploys de hoy si el build de `api` no se actualizó — posible: el script de deploy no falla aunque `docker compose up --build` tenga errores parciales, o el 429 es intermitente y en otro momento del día sí pasó. Revisar logs de Actions de esos 2 runs específicos para confirmar si hubo 429 ahí también (silencioso).

**Riesgo actual**: CERO — ningún cliente WooCommerce activo en producción (MP Cars es la prueba de hoy). El widget de WhatsApp en mpcars.cl quedó activo y funcional (eso usa código que SÍ está deployado de antes). Solo el handshake `/verify` y la validación de dominio en ingest (código nuevo de hoy) no están activos todavía — pero tampoco lo estaban antes, así que no es una regresión.