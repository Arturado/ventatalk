# WhatsApp Embedded Signup — Spec de Arquitectura

> Para: sesión de Claude Code en repo `ventatalk`
> Objetivo: permitir que cada business (tenant) conecte su propio número de WhatsApp Business a la App de Meta de VentaTalk, sin intervención manual en DB.
> Contexto: hoy el `message_processor` ya rutea correctamente por `phone_number_id` → `business_id` (confirmado funcionando con el sandbox de VentaTalk). Lo que falta es el flujo de **conexión** que llena la tabla `phone_numbers` automáticamente.

---

## 0. Buena noticia que cambia el roadmap

Meta permite **hasta 2 números de teléfono "trial"** por Business Manager **antes** de completar Business Verification (post-verificación: 25 números). Esto significa:

- Podemos construir y probar el flujo completo de Embedded Signup AHORA, conectando 1-2 pilotos reales como "trial numbers"
- El **App Review de Meta** (Advanced Access para `whatsapp_business_management`) corre EN PARALELO, no bloquea el desarrollo
- Riesgo real: si tienes 3 pilotos (MP Cars, clínica, Pace Coffee) y quieres los 3 con WhatsApp real antes de completar verification, solo 2 podrán conectarse hasta que la verification + review estén listos

**Acción inmediata para Hanowar (en paralelo al desarrollo, hacer HOY):**
1. Ve a Meta for Developers → tu App → **Facebook Login for Business → Settings**
2. En "Client OAuth Settings", agrega a **Allowed Domains for the JavaScript SDK** y **Valid OAuth Redirect URIs**: `https://app.ventatalk.com`
3. Ve a **Facebook Login for Business → Configurations** → "+ Create Configuration"
   - Caso de uso: WhatsApp Business
   - Permisos: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`
   - Guarda el `config_id` generado — lo necesitamos para el frontend
4. **Inicia el proceso de Business Verification** en business.facebook.com (Configuración del negocio → Seguridad y verificación) — esto tarda días, empieza ya. Y en paralelo, **solicita App Review** para Advanced Access de los 3 permisos arriba — también tarda, empieza ya
5. Confirma si tu App está en modo **Live** (no Development) — para Embedded Signup con negocios externos (no solo admins/testers de tu app) necesita estar Live

Esto NO requiere a Claude Code — es 100% configuración en Meta, hazlo cuando puedas.

---

## 1. Flujo end-to-end

```
[Dashboard VentaTalk]                [Meta]                      [Backend VentaTalk]
        |                              |                                |
  Click "Conectar WhatsApp"            |                                |
        |---- FB.login(config_id) ---->|                                |
        |                              |  (usuario autoriza, Meta       |
        |                              |   crea/vincula WABA + número)  |
        |<--- authResponse.code -------|                                |
        |                                                                |
        |---- POST /api/v1/integrations/whatsapp/connect { code } ----->|
        |                                                                |
        |                              |<-- exchange code por token ----|
        |                              |--- token + waba_id ----------->|
        |                              |                                |
        |                              |<-- GET /{waba_id}/phone_numbers|
        |                              |--- phone_number_id, display ->|
        |                              |                                |
        |                              |<-- POST /{waba_id}/subscribed_apps (suscribe webhook)
        |                              |                                |
        |                                          INSERT/UPDATE phone_numbers
        |                                          (business_id, phone_number_id,
        |                                           phone_number, access_token, waba_id)
        |<------------------- 200 OK { connected: true, phone_number } -|
```

Una vez insertada la fila en `phone_numbers`, el flujo de mensajería YA FUNCIONA — `webhook.py` / `message_processor.py` no necesitan cambios (confirmado con el sandbox).

---

## 2. Backend — cambios necesarios

### 2.1 Nuevas variables de entorno (`.env.production`, `.env.example`)

```bash
META_APP_ID=<App ID de Meta, visible en App Dashboard → Configuración → Básica>
META_CONFIG_ID=<config_id generado en paso 0.3>
```

`META_APP_SECRET` y `WHATSAPP_API_VERSION` ya existen (confirmados: `v25.0`).

### 2.2 Nuevo endpoint: `app/api/v1/endpoints/integrations.py`

```
POST /api/v1/integrations/whatsapp/connect
  body: { "code": "<authResponse.code del FB.login>" }
  auth: JWT del usuario (requiere business_id del token)

  1. Intercambiar code por access token:
     GET https://graph.facebook.com/{WHATSAPP_API_VERSION}/oauth/access_token
       ?client_id={META_APP_ID}
       &client_secret={META_APP_SECRET}
       &code={code}
     → devuelve access_token (verificar en docs v25.0 si requiere exchange adicional
       a long-lived token, o si Embedded Signup ya devuelve uno de larga duración)

  2. Obtener WABA ID:
     - Embedded Signup con `extras.setup` puede devolver waba_id directo en el
       evento postMessage del SDK (ver doc oficial); si no, usar:
     GET /{business_id}/owned_whatsapp_business_accounts (con el token obtenido)

  3. Obtener phone_number_id + número:
     GET /{waba_id}/phone_numbers
     → tomar el primer número (o permitir selección si hay varios)
       campos: id (=phone_number_id), display_phone_number, verified_name

  4. Suscribir la app a los webhooks de ese WABA:
     POST /{waba_id}/subscribed_apps
       (con el access_token del paso 1)

  5. Upsert en tabla phone_numbers:
     - business_id: del JWT del usuario autenticado
     - phone_number_id: del paso 3
     - phone_number: display_phone_number del paso 3
     - display_name: verified_name del paso 3
     - access_token: del paso 1 (texto plano, igual que el sandbox)
     - waba_id: del paso 2
     - is_active: true
     UNIQUE constraint en phone_number_id ya existe — usar ON CONFLICT DO UPDATE

  6. Responder { connected: true, phone_number, display_name }

GET /api/v1/integrations/whatsapp/status
  → devuelve el/los phone_numbers del business_id actual (sin exponer access_token)

DELETE /api/v1/integrations/whatsapp/{phone_number_id}
  → is_active = false (no borrar — preserva historial de conversations)
  → opcional: POST /{waba_id}/subscribed_apps DELETE para des-suscribir
```

### 2.3 Sin migración de DB necesaria

`phone_numbers` ya tiene exactamente las columnas requeridas (confirmado vía `\d phone_numbers` en producción). Solo falta el código que la llene.

---

## 3. Frontend — cambios necesarios

### 3.1 Nueva variable de entorno (build arg, como `NEXT_PUBLIC_API_URL`)

```bash
NEXT_PUBLIC_META_APP_ID=<mismo META_APP_ID>
NEXT_PUBLIC_META_CONFIG_ID=<mismo META_CONFIG_ID>
```

Agregar a `docker-compose.prod.yml` → `frontend.build.args` (patrón ya conocido para `NEXT_PUBLIC_*`).

### 3.2 Nueva sección en `/dashboard/integrations`

- Card "WhatsApp Business"
- Si no conectado: botón "Conectar WhatsApp" que carga el JS SDK de Facebook y dispara:
  ```js
  FB.login(function(response) {
    if (response.authResponse?.code) {
      // POST a /api/v1/integrations/whatsapp/connect
    }
  }, {
    config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
    response_type: 'code',
    override_default_response_type: true,
    extras: { setup: {}, sessionInfoVersion: 3, featureType: 'whatsapp_business_app_onboarding' }
  });
  ```
- Si conectado: mostrar número + nombre verificado + botón "Desconectar"

---

## 4. Plan de testing

1. Usar el propio número de WhatsApp personal de Hanowar (o un número nuevo SIM) como "trial number" #2 (el #1 ya es el sandbox de VentaTalk)
2. Completar el flujo de Embedded Signup desde `app.ventatalk.com` apuntando al business "VentaTalk Admin Demo" o uno de prueba nuevo
3. Verificar fila creada en `phone_numbers` automáticamente (sin SQL manual)
4. Enviar WhatsApp a ese número, confirmar que el bot responde con el catálogo/contexto del business correcto
5. Probar "Desconectar" → verificar `is_active=false` y que mensajes nuevos a ese número ya no se procesan

---

## 5. Decisiones pendientes / a verificar durante el build

- [ ] Exacto mecanismo de exchange de `code` → token con Embedded Signup v25.0 (puede diferir de OAuth estándar — revisar docs actuales de Meta al implementar)
- [ ] ¿El token devuelto es long-lived o requiere exchange adicional? (afecta si necesitamos lógica de refresh)
- [ ] ¿Qué pasa si un WABA tiene múltiples phone numbers? — para MVP, tomar el primero; UI de selección es mejora futura
- [ ] Billing: Meta cobra por conversación a nivel de WABA — definir si VentaTalk paga (pass-through en el plan) o el cliente paga directo (fuera de scope de este spec, pero impacta mensaje legal/ToS)

---

## 6. Orden de ejecución sugerido

1. Hanowar: pasos de Meta (sección 0) — iniciar HOY, corre en paralelo
2. Claude Code: backend (sección 2) — endpoint + upsert en `phone_numbers`
3. Claude Code: frontend (sección 3) — UI + JS SDK
4. Testing end-to-end (sección 4) con 1 número trial real
5. Una vez validado, repetir conexión para los pilotos que aplique (límite: 2 trial numbers hasta completar verification)