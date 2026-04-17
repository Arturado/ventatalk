# VentaTalk — Contexto del Proyecto

## Qué es
SaaS B2B — agente de ventas IA para WhatsApp + CRM.
Enfocado en PYMEs chilenas y Latam.
Nombre anterior: VentaBot. Nombre definitivo: VentaTalk.
Dominios disponibles: ventatalk.com / ventatalk.cl (compra pendiente).

## Stack

### Backend
- Python + FastAPI
- SQLAlchemy async
- PostgreSQL + pgvector
- OpenAI GPT-4o-mini
- LangChain
- Celery + Redis

### Frontend
- Next.js 14 + Tailwind CSS
- Componentes separados en /components (recién refactorizados)
- Estructura: ui/, dashboard/, auth/, shared/

### Infra
- Docker Compose
- Ubuntu local (Acer Nitro AN515-42)
- Ruta local: ~/proyectos/personal/ventabot

## Estado actual
- API en localhost:8000
- Dashboard en localhost:3000
- Login demo: admin@lumina.cl / demo1234
- Webhook de WhatsApp funcionando (modo dev sin firma)
- Simulador local en scripts/dev_simulator.py

## Integraciones
- Jumpseller ✅ — 15 productos de Pace Coffee Roasters sincronizados
- Bsale ✅ — 161 productos sincronizados, fix de precios aplicado
  - Fix: reemplazar get_variant_price() por get_all_prices() en backend/app/services/integrations/bsale.py
  - price_list_id: 227 (Lista de Precios Base)
  - Pendiente: testear y re-sincronizar en contenedor

## Clientes piloto (sandbox, sin costo)
1. Clínica estética (WordPress)
2. Tienda de repuestos (WordPress)
3. Pace Coffee Roasters (Jumpseller) ✅

## Roadmap acordado
1. ~~Fix precios Bsale~~ → hecho, pendiente testeo
2. Selector de fuente única de catálogo (CSV vs integración, con limpieza al cambiar)
3. Submenu Integraciones en Settings (tokens + gestión WhatsApp)
4. Pipeline del lead visible dentro de la vista de conversación
5. Tracking de conversiones con parámetro ?vt_conv=
6. Plugin WordPress
7. Deploy en Railway + dominio ventatalk.com

## Features pendientes de producto
- Selector de fuente única de catálogo con limpieza al cambiar
- Submenu Integraciones en Settings con tokens y gestión de WhatsApp
- Pipeline del lead visible dentro de la vista de conversación
- Tracking de conversiones atribuidas al chatbot con vt_conv

## UI/UX
- UI UX Pro Max instalado (67 estilos, 161 reglas por industria)
- Componentes refactorizados hoy desde páginas monolíticas
- Estilo objetivo: SaaS B2B tech, profesional pero accesible para PYMEs

## Convenciones del proyecto
- Claude Code es el driver principal (ejecuta, modifica, corre comandos)
- Claude Web es consultor/estrategia (arma prompts, revisa arquitectura)
- No pegar código generado por Claude Web directamente — siempre pasar por Claude Code
- Opción 2 (don't ask again) para comandos de solo lectura: tsc, eslint, grep
- Opción 1 siempre para Docker y comandos que modifican estado

## Contexto de negocio
- Sandbox activo con 3 pilotos reales que dan feedback
- No se busca vender "vendas más" — se busca entender necesidades reales y cubrirlas
- Foco en intuitividad, no en feature bloat
- Arquitectura: búsqueda semántica con pgvector para catálogos grandes (no pasar todo a OpenAI)
