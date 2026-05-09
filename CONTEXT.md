# VentaTalk — CONTEXT para Claude Code

> Leer completo antes de hacer cualquier cambio.
> Última actualización: Mayo 2026

## Estructura del Monorepo

```
backend/app/api/v1/endpoints/
  admin.py, auth.py, billing.py, business.py
  conversations.py, contacts.py, integrations.py
  tracking.py, webhook.py, chat_widget.py

frontend/app/dashboard/
  page.tsx (overview)
  conversations/page.tsx   ← layout estilo WhatsApp Web
  contacts/, leads/
  ecommerce/
    productos/page.tsx     ← tabla con toggle is_available conectado
    orders/page.tsx        ← placeholder
    cupones/page.tsx       ← placeholder
  integrations/, settings/

components/dashboard/Sidebar.tsx  ← secciones: Principal, Ecommerce, Sistema
components/ui/ThemeProvider.tsx   ← forzado light (enableSystem=false)
lib/api.ts                        ← baseURL = NEXT_PUBLIC_API_URL + "/api/v1"

scripts/wordpress-plugin/ventatalk/  ← v1.1.0
```

## Endpoints Backend — Referencia

### Business (/api/v1/business/)
```
GET    /catalog                 → CatalogItem[] con image_url y stock_quantity
DELETE /catalog/source/{name}  ← elimina productos de esa fuente
PATCH  /catalog/{id}/toggle    → activa/desactiva is_available
GET/POST /catalog/source       → fuente activa
GET    /usage
```

### Integraciones (/api/v1/integrations/)
```
WooCommerce: token, status, ingest, revoke-token
Jumpseller/Bsale/Shopify/MercadoLibre: connect, sync, status, disconnect
```

### Admin (/api/v1/admin/) — requiere SUPERADMIN_EMAIL
```
GET  /stats/overview
GET  /businesses?page=&search=&limit=
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

## Interfaces TypeScript Clave (lib/api.ts)

```typescript
interface CatalogItem {
  id: string
  name: string
  price?: number
  is_available: boolean
  source: string
  image_url?: string       // desde metadata_
  stock_quantity?: number  // desde metadata_
}

businessApi.toggleCatalogItem(id, isAvailable)   // PATCH /business/catalog/{id}/toggle
businessApi.deleteCatalogSource(sourceName)       // DELETE /business/catalog/source/{name}
businessApi.getCatalog()                          // GET /business/catalog
```

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
```

## Patrones Frontend

```tsx
// Thumbnail con fallback
const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())
{item.image_url && !imgErrors.has(item.id) ? (
  <img src={item.image_url} onError={() => setImgErrors(prev => new Set(prev).add(item.id))} />
) : (
  <div className="w-10 h-10 bg-gray-100"><Package /></div>
)}

// Optimistic update
setItems(prev => prev.map(i => i.id === item.id ? {...i, is_available: newValue} : i))
try { await businessApi.toggleCatalogItem(item.id, newValue) }
catch { setItems(prev => prev.map(i => i.id === item.id ? {...i, is_available: !newValue} : i)) }
```

## Plugin WordPress (v1.1.0)

Payload que envía a /api/v1/integrations/woocommerce/ingest:
```json
{ "external_id", "name", "description", "price", "category",
  "image_url", "stock_quantity", "is_available" }
```
Auth: Header `X-VentaTalk-Token`
Hooks tiempo real: woocommerce_update_product, woocommerce_product_set_stock, woocommerce_product_set_price

## Errores Conocidos

1. **asyncpg enum bug** → values_callable en todos los Enum
2. **JSONB no persiste** → flag_modified antes de commit
3. **CORS bloqueado** → casi siempre es 500/429, debug con curl OPTIONS
4. **Rate limiter bloquea OPTIONS** → skipear OPTIONS en rate_limit.py middleware
5. **NEXT_PUBLIC_ vacío en prod** → pasar como ARG en Dockerfile + build arg en compose
6. **git pull falla** → git stash primero + chown -R hanowar /repo/.git
7. **Frontend OOM** → mem_limit 1.5g + swap 2GB aplicados
8. **Deploy timeout** → timeout-minutes: 20, command_timeout: 18m en workflow

## Comandos VPS

```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml exec db psql -U ventatalk -d ventatalk
chown -R hanowar:hanowar /home/hanowar/REPO/
```

## Reglas de Negocio

- Conversación = hilo completo (no mensajes). Reset el día 1 cada mes.
- is_available=False → bot no lee el producto en RAG
- Superadmin: mismo login, verificado por SUPERADMIN_EMAIL=admin@ventatalk.com
- WhatsApp outbound: SOLO templates aprobados por Meta
- Tokens: siempre Fernet encrypt, UI solo muestra últimos 4-8 chars

## Clientes Piloto

| Cliente | Integración | Estado |
|---|---|---|
| Clínica cosmética | WordPress/WooCommerce | Plugin instalado |
| Repuestos automotriz | WordPress/WooCommerce | Plugin instalado |
| Pace Coffee Roasters | Jumpseller | 15 productos synced |
