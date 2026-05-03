# VentaTalk — SPEC General del Proyecto

> Documento de referencia técnica y de producto. Actualizar antes de iniciar cualquier desarrollo nuevo.

---

## 1. Visión General

VentaTalk es un agente de ventas IA para WhatsApp + CRM, orientado a PYMEs chilenas y latinoamericanas. El producto es multi-tenant: cada cliente tiene su propio espacio aislado con su catálogo, conversaciones y configuración.

---

## 2. Arquitectura de Subdominios

| Subdominio | Repo | Propósito |
|---|---|---|
| `ventatalk.com` | `ventatalk-web` | Landing, planes, registro, checkout Stripe |
| `app.ventatalk.com` | `ventatalk` (frontend) | Dashboard del cliente |
| `api.ventatalk.com` | `ventatalk` (backend) | API FastAPI — compartida por todos |
| `admin.ventatalk.com` | `ventatalk-admin` (nuevo) | Panel interno VentaTalk |

### Notas de infraestructura
- `api.ventatalk.com` reemplaza la exposición directa del puerto `8000`. Nginx hace proxy hacia el contenedor.
- `admin.ventatalk.com` protegido con Basic Auth a nivel Nginx (antes de llegar a Next.js) + header `X-Robots-Tag: noindex, nofollow` + `robots.txt` con `Disallow: /`.
- El backend es **uno solo**, compartido. Los tres frontends se autentican contra él con JWT. El rol del token determina qué puede hacer cada uno (`client`, `superadmin`).

---

## 3. Repositorios

| Repo | URL | Estado |
|---|---|---|
| `ventatalk` | github.com/Arturado/ventatalk | Activo — app + backend |
| `ventatalk-web` | github.com/Arturado/ventatalk-web | Activo — landing |
| `ventatalk-admin` | Por crear | Panel interno |

### Estructura en VPS (`/home/hanowar/`)
```
ventatalk/              ← repo principal (backend + frontend app)
ventatalk-web/          ← landing ventatalk.com
wordpress-agencia-dn/   ← instancia WordPress cliente (no tocar)
deploy.sh               ← deploy manual ventatalk
deploy-web.sh           ← deploy manual ventatalk-web
```

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
- Auth con JWT

### Infraestructura
- VPS único (por ahora)
- Docker Compose por proyecto
- Nginx como reverse proxy
- CI/CD: deploy scripts manuales por ahora → migrar a GitHub Actions

---

## 5. Contenedores en Producción (estado actual)

```
ventatalk-frontend-1     → puerto 3000  (app.ventatalk.com)
ventatalk-api-1          → puerto 8000  (→ mover a api.ventatalk.com)
ventatalk-worker-1       → Celery worker
ventatalk-beat-1         → Celery beat
ventatalk-redis-1        → Redis
ventatalk-db-1           → PostgreSQL + pgvector
ventatalk-web-web-1      → puerto 3001  (ventatalk.com)
wordpress-agencia-dn-*   → WordPress cliente (no tocar)
```

---

## 6. Módulos — `app.ventatalk.com` (Dashboard Cliente)

### Estado actual: funcional pero UI/UX a rediseñar completamente

| Módulo | Estado | Notas |
|---|---|---|
| Auth (login/sesión) | ✅ Funciona | |
| Conversaciones WhatsApp | ✅ Funciona | Falta mostrar pipeline status inline |
| CRM / Lead pipeline | ✅ Funciona | |
| Catálogo de productos | ✅ Funciona | Con toggles de visibilidad IA por producto |
| Integración Jumpseller | ✅ Funciona | 15 productos Pace Coffee synced |
| Integración Bsale | ⚠️ Parcial | 161/35,224 productos (límite 500 por costo embeddings) |
| Integración WordPress | ❌ Pendiente | Ver sección 9 |
| Follow-up automático | ✅ Funciona | Vía Celery beat |
| Planes / Billing | ❌ Pendiente | Mover lógica a ventatalk.com + Stripe |
| Conversion tracking | ❌ Pendiente | Parámetro `?vt_conv=` |

---

## 7. Módulos — `admin.ventatalk.com` (Panel Interno)

> Repo nuevo: `ventatalk-admin`. Stack: Next.js + Tailwind. Auth: JWT con rol `superadmin`.

| Módulo | Descripción |
|---|---|
| Vista de tenants | Lista de todos los clientes activos/inactivos |
| Detalle de tenant | Plan activo, integraciones conectadas, uso de productos/embeddings |
| Control de planes | Activar/desactivar features por cliente manualmente |
| Estado de integraciones | Ver si Bsale/Jumpseller/WordPress está conectado y cuándo fue el último sync |
| Métricas globales | Conversaciones totales, leads generados, conversiones |
| Gestión de usuarios | Crear/desactivar cuentas de clientes |
| Logs de sistema | Errores de webhooks, fallos de sync, etc. |

---

## 8. `ventatalk.com` — Landing + Billing

### Lo que vive acá (además del marketing):
- Página de planes y precios
- Registro de nuevos clientes
- Checkout con Stripe (suscripciones)
- Webhooks de Stripe (`/api/stripe/webhook`)
- Portal de cliente Stripe (cambio de plan, facturas)

### Definición de "conversación":
> Un **hilo completo** con un cliente (no mensajes individuales). El contador se incrementa cuando se inicia un nuevo hilo, no por cada mensaje dentro de él.

### Planes base:

| | Starter | Pro | MAX |
|---|---|---|---|
| Precio mensual | $90 USD | $190 USD | $499 USD |
| Precio anual | $900 USD | $1,900 USD | $4,790 USD |
| Descuento anual | ~17% (2 meses gratis) | ~17% | ~20% |
| Conversaciones incluidas | 200 | 1,000 | 3,000 |
| Conv. adicional | $0.40 USD | $0.40 USD | $0.30 USD |
| Tiendas conectadas | 1 | 1 | 1 |
| Números WhatsApp | 1 | 3 | 4 |
| Carritos abandonados | ✅ | ✅ | ✅ |
| Campañas outbound | ❌ | ✅ | ✅ |
| Módulo Reviews | ❌ | ✅ | ✅ |
| Módulo B2B / Cotizaciones | ❌ | ❌ | ✅ |
| Soporte | Estándar | WhatsApp | WhatsApp + Reuniones |

> Descuento anual es promoción de lanzamiento 2025-2026. Se ajusta el año siguiente.

### Add-ons (sobre cualquier plan):

| Add-on | Precio USD/mes |
|---|---|
| Tienda adicional | $150 |
| Número WhatsApp adicional | $20 |
| Bolsa conversaciones extra | $150 |
| Módulo MercadoLibre | $150 |
| Canal Instagram | $20 |

> Add-ons son Stripe Products separados ligados al `subscription_id` del tenant. El webhook de Stripe actualiza los `features` del tenant en DB al activar/desactivar.

### Módulos de producto por desarrollar (en orden de prioridad):

#### Carritos abandonados
- El agente detecta cuando un cliente inició una consulta de compra pero no completó
- Envía follow-up automático vía WhatsApp (ya tenemos Celery beat — extender esta lógica)
- **Estado: por desarrollar**

#### Campañas outbound / WhatsApp Marketing (Plan Pro+)
- Envío masivo a contactos del CRM
- Opciones a evaluar: integración con Mailchimp del cliente vs servicio propio
- **Restricción importante:** WhatsApp Business API tiene políticas estrictas sobre mensajes outbound — solo se pueden enviar con templates aprobados por Meta. Investigar antes de comprometerse con el cliente.
- **Estado: por definir + desarrollar**

#### Módulo Reviews (Plan Pro+)
- El agente solicita reseña al cliente al finalizar una compra/conversación
- Puede redirigir a Google Maps, Trustpilot u otro según config del tenant
- **Estado: por desarrollar**

#### Módulo B2B / Agente de Cotizaciones (Plan MAX)
- El agente puede generar cotizaciones formales (PDF y/o email) o responder precios por WhatsApp
- El cliente elige qué modalidad habilitar desde su dashboard
- **Estado: por desarrollar**

### Flujo de registro:
1. Usuario llega a `ventatalk.com/planes`
2. Elige plan + ciclo (mensual/anual) + add-ons opcionales → Stripe Checkout
3. Pago exitoso → webhook Stripe crea tenant en DB con `features` correspondientes
4. Se envía email con credenciales para `app.ventatalk.com`
5. Cliente gestiona plan/add-ons desde portal Stripe o desde `app.ventatalk.com`

### Repo: `ventatalk-web`
- `docker-compose.yml` actualmente **solo existe en el VPS**, no commiteado → **corregir**
- `NEXT_PUBLIC_API_URL` hardcodeado como build arg → actualizar a `api.ventatalk.com` cuando se migre

---

## 9. Integración WordPress

### Modelo actual (incorrecto):
VentaTalk se conecta al WordPress del cliente y hace pull de productos.

### Modelo objetivo:
**Plugin WordPress** instalado en el sitio del cliente que hace **push hacia `api.ventatalk.com`** cuando hay cambios (productos nuevos, actualizaciones, eliminaciones).

### Flujo:
1. Cliente instala plugin en su WordPress
2. Plugin recibe webhook key única por tenant
3. En cada cambio de producto → POST a `api.ventatalk.com/webhooks/wordpress/{tenant_key}`
4. API procesa, genera embeddings, guarda en catálogo

### Ventajas:
- No se necesitan credenciales del WordPress del cliente
- Sync en tiempo real sin polling
- Lógica de re-sync manual disponible desde el dashboard

---

## 10. Pendientes Técnicos Priorizados

### P0 — Crítico (bloquea arquitectura)
- [ ] Configurar `api.ventatalk.com` en Nginx (quitar exposición directa puerto 8000)
- [ ] Separar `.env.production` y `.env.development`
- [ ] Commitear `docker-compose.yml` de `ventatalk-web` al repo

### P1 — Alta prioridad (producto)
- [ ] Crear repo `ventatalk-admin` con estructura base
- [ ] Mover lógica de planes/billing a `ventatalk.com` + Stripe (con planes Starter/Pro/MAX)
- [ ] Modelo de `features` por tenant en DB (controlar qué módulos tiene activos cada cliente)
- [ ] Contador de conversaciones por tenant (hilo completo, no mensajes)
- [ ] Bsale: reemplazar fetch por variante con bulk price list
- [ ] Pipeline status visible dentro de conversaciones
- [ ] Campo `channel` en conversaciones (whatsapp / instagram) + filtro en UI

### P2 — Media prioridad
- [ ] Módulo carritos abandonados (extender Celery beat)
- [ ] Módulo Reviews (solicitar reseña al cierre de conversación)
- [ ] Plugin WordPress (push → API)
- [ ] Deploy automático con GitHub Actions (por repo)
- [ ] Conversion tracking `?vt_conv=`
- [ ] `NEXT_PUBLIC_API_URL` como build arg en Dockerfile (ventatalk-web)
- [ ] Guardar secrets sensibles en GitHub Secrets

### P3 — Backlog
- [ ] Integración Shopify
- [ ] Integración MercadoLibre (add-on $150)
- [ ] Canal Instagram DM (add-on $20) — ver sección 14
- [ ] Optimización costos embeddings (batch processing, caché)
- [ ] Límite de productos Bsale por plan (no fijo en 500)
- [ ] Add-ons: número WhatsApp adicional, tienda adicional, bolsa conversaciones

---

## 11. Deploy Automático (GitHub Actions)

> Cada repo tiene su propio workflow independiente.

### Flujo objetivo por repo:
```
push a main
  → GitHub Actions
    → SSH al VPS
      → git pull
      → docker compose build
      → docker compose up -d
```

### Archivos a crear por repo:
- `.github/workflows/deploy.yml`
- Secrets en GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

### Scripts actuales en VPS:
- `deploy.sh` → ventatalk
- `deploy-web.sh` → ventatalk-web

Estos scripts pueden ser la base de los steps de GitHub Actions.

---

## 12. Seguridad

- [ ] Basic Auth en Nginx para `admin.ventatalk.com`
- [ ] `X-Robots-Tag: noindex, nofollow` en `admin.ventatalk.com`
- [ ] Rate limiting en `api.ventatalk.com` a nivel Nginx
- [ ] CORS configurado explícitamente por origen (`app.`, `admin.`, `ventatalk.com`)
- [ ] Fernet encryption para tokens de integración (ya implementado)
- [ ] Tokens mostrados solo como hint `...xxxx` en UI (ya implementado)

---

## 13. Decisiones Técnicas Clave

| Decisión | Razón |
|---|---|
| Backend compartido entre los 3 frontends | Evita duplicar lógica, un solo punto de verdad |
| Plugin push para WordPress (no pull) | No requiere credenciales del cliente, sync en tiempo real |
| Admin en repo separado | Deploy independiente, permisos separados, ciclos de release distintos |
| Stripe vive en ventatalk.com | Separa concern de marketing/billing del dashboard operativo |
| Límite 500 productos Bsale | Costo de embeddings OpenAI — ajustar por plan cuando esté billing |
| Conversación = hilo completo | No por mensaje — más justo para el cliente, más fácil de contar |
| Instagram en CRM unificado | Misma vista con filtro de canal — no sección separada |
| Campañas outbound: evaluar primero políticas Meta | WhatsApp solo permite outbound con templates aprobados — validar antes de prometer |
| Features por tenant en DB | Permite activar/desactivar módulos por plan sin redesplegar código |

---

## 14. Canal Instagram (Add-on $20 USD/mes)

### Concepto:
El mismo agente IA responde **Instagram Direct Messages** como canal de venta adicional. No es una sección separada — las conversaciones de Instagram se unifican en el mismo CRM con un identificador de canal (`whatsapp` / `instagram`) y filtro por canal en la vista.

### Stack técnico:
- **Meta Graph API** — mismo ecosistema que WhatsApp Business API
- Webhook → `api.ventatalk.com/webhooks/instagram/{tenant_key}`
- Mismo pipeline RAG + GPT-4o-mini
- Conversaciones unificadas: mismo hilo/vista con ícono de canal

### Consideraciones técnicas:
- Requiere **Instagram Business Account** vinculada a Facebook Page
- Permiso `instagram_manage_messages` requiere review de Meta para producción
- Ventana de mensajería 24h igual que WhatsApp
- Conexión desde `app.ventatalk.com` → Integraciones (mismo flujo que WhatsApp)

### Módulos afectados:
- Backend → nuevo webhook handler + adaptador de canal
- CRM → campo `channel` en conversaciones + filtro UI
- `app.ventatalk.com` → Integraciones: conectar cuenta Instagram
- `admin.ventatalk.com` → visibilidad de qué tenants tienen Instagram activo

---

*Última actualización: Mayo 2026*
