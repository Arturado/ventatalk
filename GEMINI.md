# VentaTalk — GEMINI.md (Estado del Proyecto & Contexto)

> Documento de contexto activo para iteraciones con AI colaboradores.
> Última actualización: Julio 2026 — v1.2.0 WordPress Plugin Ready

---

## 1. Resumen Ejecutivo
VentaTalk es un SaaS B2B multi-tenant de ventas asistidas por IA para WhatsApp + CRM orientado a PYMEs en Latinoamérica. 
El enfoque actual está en la **presentación a inversionistas y cierre de clientes piloto**, priorizando el pulido estético, estabilidad del stack y experiencia de usuario en entorno Local/Sandbox.

---

## 2. Estado de la Infraestructura & Desarrollo Local

### Entorno Local (Sincronizado & Operativo)
- **Base de Datos:** PostgreSQL en Docker (`ventatalk_db`) con pgvector. 
- **Migraciones Alembic:** Aplicadas de forma limpia hasta `fdadc6a23121_add_orders_and_coupons`.
- **Usuario Dev:** `admin@ventatalk.com` / `admin123` (Business: `Dev Company`, slug: `dev-company`).
- **Servidor API:** FastAPI corriendo en `http://localhost:8000` (`PYTHONPATH=. uvicorn app.main:app --reload`).
- **Sandbox Meta WhatsApp:** Bot respondiendo end-to-end sobre catálogo real mediante System User permanente.

### Servidor Producción (VPS Donweb)
- **Host:** `179.43.124.82` (SSH puerto `5743`, usuario `hanowar`).
- **Hardening:** Containers non-root, UFW, Fail2ban, SSH key-only.
- **Nginx Reverse Proxy:** 4 Server blocks activos (`ventatalk.com`, `app.`, `api.`, `admin.`).

---

## 3. Stack Técnico

- **Backend:** Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL + pgvector, Redis, Celery.
- **Frontend:** Next.js 15+, React, TypeScript, Tailwind CSS.
- **WordPress Plugin (v1.2.0):** PHP, CSS (VentaTalk palette), JS (vanilla). Sincronización en tiempo real vía WooCommerce Hooks.
- **Infra:** Docker Compose, Nginx.

---

## 4. Comandos Clave de Trabajo Local

Siempre ejecutar desde la carpeta `backend/` con el entorno virtual activado (`source ../venv/bin/activate`):

```bash
# 1. Correr migraciones de Alembic
DATABASE_URL="postgresql+asyncpg://ventatalk:posgres@localhost:5432/ventatalk_db" DATABASE_URL_SYNC="postgresql://ventatalk:posgres@localhost:5432/ventatalk_db" PYTHONPATH=. alembic upgrade head

# 2. Levantar el servidor FastAPI Backend
DATABASE_URL="postgresql+asyncpg://ventatalk:posgres@localhost:5432/ventatalk_db" DATABASE_URL_SYNC="postgresql://ventatalk:posgres@localhost:5432/ventatalk_db" PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

---

## 5. Plugin WordPress VentaTalk (v1.2.0)

El plugin ha sido actualizado a la versión **1.2.0** con las siguientes mejoras:
- **Menú Top-Level:** Ubicado en la barra lateral principal de WP-Admin (Posición 58, debajo de WooCommerce).
- **UI/UX Refinada:** Interfaz tipo Dashboard con paleta VentaTalk (Verde `#10B981`, fondos claros, cards con sombras).
- **Handshake de Dominio:** Validación automática del token contra `/api/v1/integrations/woocommerce/verify` para "atar" el token al sitio.
- **Tracking 2.0:** Sincronización de productos incluye ahora el campo `product_url`.

---

## 6. Roadmap Priorizado (Estrategia "Producto Pulido")

### 🔴 P0 — Infraestructura & Despliegue Backend
1. **Fix Deploy VPS v1.2.0 (Docker Hub Rate Limit):** Resolver el 429 de Docker Hub en VPS y reconstruir la imagen de la API.

### 🟠 P1 — Re-onboarding Pilotos
2. **Instalación v1.2.0:** Reinstalar plugin en **MP Cars** y **Clínica Cosmética**.
3. **Sincronización Total:** Forzar sync de catálogos para asegurar que `product_url` esté poblado.

### 🟡 P2 — Rediseño del Dashboard (`app.ventatalk.com`) & Demo
4. **Rediseño UI/UX:** Aplicar nueva línea estética a secciones de contactos, leads y settings.
5. **Seeders de Datos:** Poblar gráficos y conversaciones de prueba para demos.

---

## 7. Lecciones Técnicas & Guardrails

1. **Variables de Entorno Pydantic:** Pydantic Settings prioriza variables de shell sobre `.env`.
2. **Carga de Modelos:** Centralizado en `app.models.models`.
3. **Persistencia en Docker:** No borrar volúmenes ante fallos de auth; usar `ALTER USER` vía `docker exec`.
4. **Regla de Oro Git:** Cambios locales → GitHub (`main`) → Deploy en VPS. NUNCA editar en caliente en el VPS.
5. **WordPress Admin CSS:** Encolar estilos custom únicamente en las páginas del plugin para evitar conflictos.
