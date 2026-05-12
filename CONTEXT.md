# VentaTalk — CONTEXT para Claude Code

> Leer completo antes de hacer cualquier cambio.
> Última actualización: Mayo 2026

## Estructura del Monorepo

```
backend/app/api/v1/endpoints/
  admin.py        ← superadmin (requiere SUPERADMIN_EMAIL)
  auth.py         ← login, register, refresh, me
  billing.py      ← Stripe checkout, webhook, portal
  business.py     ← perfil, catálogo, órdenes, cupones, usage
  conversations.py, contacts.py, integrations.py
  tracking.py     ← conversion tokens
  webhook.py      ← WhatsApp inbound

frontend/app/dashboard/
  page.tsx                    ← overview
  conversations/page.tsx      ← layout estilo WhatsApp Web
  contacts/, leads/
  ecommerce/
    productos/page.tsx        ← tabla: thumbnail, SKU, stock, toggle is_available, paginación
    orders/page.tsx           ← tabla con filtros, paginación, modal detalle
    cupones/page.tsx          ← tabla con filtros, paginación, modal detalle
  integrations/, settings/    ← settings tiene delete catalog source con confirmación

components/dashboard/Sidebar.tsx   ← secciones: Principal, Ecommerce, Sistema
components/ui/ThemeProvider.tsx    ← forzado light (enableSystem=false)
lib/api.ts                         ← baseURL = NEXT_PUBLIC_API_URL + "/api/v1"

scripts/wordpress-plugin/ventatalk/  ← v1.1.0
  ventatalk.php
  includes/settings.php
  public/js/widget.js
```

## Endpoints Backend — Referencia Completa

### Business (/api/v1/business/)
```
GET    /catalog                      → CatalogItem[] con image_url, stock_quantity, sku
DELETE /catalog/source/{name}        → elimina productos de esa fuente
PATCH  /catalog/{id}/toggle          → activa/desactiva is_available
GET/POST /catalog/source             → fuente activa del catálogo
GET    /orders?page&limit&search&status&payment_method  → paginado
GET    /coupons?page&limit&search&is_active             → paginado
GET    /usage
GET/PUT /profile
```

### Integraciones (/api/v1/integrations/)
```
WooCommerce:
  POST   /woocommerce/token
  GET    /woocommerce/status
  POST   /woocommerce/ingest          → productos (X-VentaTalk-Token)
  POST   /woocommerce/orders/ingest   → órdenes (X-VentaTalk-Token)
  POST   /woocommerce/coupons/ingest  → cupones (X-VentaTalk-Token)
  DELETE /woocommerce/token

Jumpseller/Bsale/Shopify/MercadoLibre:
  POST /{provider}/connect, sync | GET /status | DELETE /disconnect
```

### Admin (/api/v1/admin/) — requiere SUPERADMIN_EMAIL
```
GET  /stats/overview
GET  /businesses?page&search&limit
GET  /businesses/{id}
PATCH /businesses/{id}/features
PATCH /businesses/{id}/plan
```

### Tracking (/api/v1/)
```
POST /conversations/{id}/tracking-link
GET  /conversations/{id}/tracking-links
GET  /track/{token}   ← público, redirige
```

## Modelos DB

### CatalogItem
```python
is_available: bool      # False = bot NO lee el producto
source: str             # csv|woocommerce|jumpseller|bsale|shopify|mercadolibre
metadata: JSONB         # image_url, stock_quantity, sku (según fuente)
embedding: Vector(1536)
```

### Order
```python
business_id, source, external_id, order_number
status: str             # pending|processing|completed|cancelled|refunded|on-hold|failed
total, currency, payment_method
customer_name, customer_email, customer_phone
items: JSONB            # [{name, qty, price, sku}]
notes, ordered_at, synced_at
UniqueConstraint: (business_id, source, external_id)
```

### Coupon
```python
business_id, source, external_id, code
discount_type: str      # percent|fixed_cart|fixed_product
discount_value, min_order_amount
usage_count, usage_limit
expires_at, is_active, description
UniqueConstraint: (business_id, source, code)
```

### Business
```python
plan: PlanType          # starter|pro|max
billing_cycle           # monthly|annual
stripe_customer_id, stripe_subscription_id
features: JSONB         # features activos + add-ons
conversations_this_month, conversations_reset_at
integrations: JSONB     # config de cada integración (tokens encriptados)
```

### Conversation
```python
channel: str            # whatsapp|instagram
status: ConversationStatus
```

## lib/api.ts — Interfaces Clave

```typescript
interface CatalogItem {
  id, name, price?, is_available, source
  image_url?, stock_quantity?, sku?
}

interface Order {
  id, order_number, status, total, currency
  payment_method?, customer_name?, customer_email?, customer_phone?
  items: OrderItem[], notes?, ordered_at?, source
}

interface Coupon {
  id, code, discount_type, discount_value
  description?, min_order_amount?, usage_count, usage_limit?
  expires_at?, is_active, source
}

businessApi.toggleCatalogItem(id, isAvailable)    // PATCH /business/catalog/{id}/toggle
businessApi.deleteCatalogSource(name)              // DELETE /business/catalog/source/{name}
businessApi.getCatalog()                           // GET /business/catalog
businessApi.getOrders(params)                      // GET /business/orders
businessApi.getCoupons(params)                     // GET /business/coupons
```

## Plugin WordPress (v1.1.0)

Funciones principales:
- `ventatalk_build_product_payload($id)` → payload de producto
- `ventatalk_build_order_payload($id)` → payload de orden
- `ventatalk_build_coupon_payload($id)` → payload de cupón
- `ventatalk_push_single_product($id)` → push individual
- `ventatalk_push_single_order($id)` → push individual
- `ventatalk_push_single_coupon($id)` → push individual

Hooks tiempo real:
- `woocommerce_update_product` → push producto
- `woocommerce_product_set_stock` → push producto
- `woocommerce_product_set_price` → push producto
- `woocommerce_new_order` → push orden
- `woocommerce_order_status_changed` → push orden
- `woocommerce_coupon_options_save` → push cupón

Payload producto incluye: name, price, description, category, image_url, stock_quantity, sku, is_available
Auth: Header `X-VentaTalk-Token`

## Patrones Backend

```python
# Enums — SIEMPRE values_callable
Enum(PlanType, name="plan_type", values_callable=lambda x: [e.value for e in x])

# JSONB — SIEMPRE flag_modified
from sqlalchemy.orm.attributes import flag_modified
business.integrations["key"] = {...}
flag_modified(business, "integrations")
await db.commit()

# Encriptación
from app.core.encryption import encrypt_token, decrypt_token, mask_token
# Guardar encriptado, desencriptar solo en background tasks
# UI: mask_token(enc) → "...xxxx"

# Paginación estándar (ver orders/coupons en business.py como referencia)
page, limit, offset = params
total = await db.scalar(select(func.count()).select_from(Model).where(...))
items = await db.execute(select(Model).where(...).offset(offset).limit(limit))
pages = math.ceil(total / limit)
return {"items": items, "total": total, "page": page, "pages": pages}
```

## Patrones Frontend

```tsx
// Thumbnail con fallback
const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())
{item.image_url && !imgErrors.has(item.id) ? (
  <img src={item.image_url} onError={() => setImgErrors(prev => new Set(prev).add(item.id))} />
) : <div className="w-10 h-10 bg-gray-100"><Package /></div>}

// Optimistic update toggle
setItems(prev => prev.map(i => i.id === id ? {...i, is_available: newVal} : i))
try { await businessApi.toggleCatalogItem(id, newVal) }
catch { setItems(prev => prev.map(i => i.id === id ? {...i, is_available: !newVal} : i)) }

// Badges de estado órdenes
pending/on-hold → amarillo | processing → azul | completed → verde
cancelled/failed → rojo | refunded → naranja
```

## Errores Conocidos

1. **asyncpg enum bug** → values_callable en todos los Enum
2. **JSONB no persiste** → flag_modified antes de commit
3. **CORS bloqueado** → casi siempre es 500/429, debug con curl OPTIONS
4. **Rate limiter bloquea OPTIONS** → skipear OPTIONS en rate_limit.py
5. **NEXT_PUBLIC_ vacío en prod** → ARG en Dockerfile + build arg en compose
6. **git pull falla** → git stash + chown -R hanowar /repo/
7. **Frontend OOM** → mem_limit 1.5g + swap 2GB
8. **Deploy timeout** → timeout-minutes: 20, command_timeout: 18m
9. **Ramas divergentes en VPS** → git config pull.rebase false && git pull

## Comandos VPS

```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml exec api alembic revision --autogenerate -m "descripcion"
docker compose -f docker-compose.prod.yml exec db psql -U ventatalk -d ventatalk
chown -R hanowar:hanowar /home/hanowar/REPO/
git config pull.rebase false  # si hay ramas divergentes
```

## Reglas de Negocio

- Conversación = hilo completo. Reset el día 1 de cada mes 00:05 UTC.
- is_available=False → bot no lee el producto en RAG
- Superadmin: login normal, verificado por SUPERADMIN_EMAIL=admin@ventatalk.com
- WhatsApp outbound: SOLO templates aprobados por Meta
- Tokens integración: siempre Fernet encrypt, UI solo últimos 4-8 chars

## Clientes Piloto

| Cliente | Integración | Estado |
|---|---|---|
| Clínica cosmética | WordPress/WooCommerce | Plugin v1.1.0 instalado |
| Repuestos automotriz (MP Cars) | WordPress/WooCommerce | 539 productos, 49 órdenes synced |
| Pace Coffee Roasters | Jumpseller | 15 productos synced |
