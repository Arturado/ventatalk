# Plugin WordPress VentaTalk v1.2.0 — Spec

> Para: sesión de Claude Code en repo `ventatalk`, carpeta del plugin (probablemente `scripts/wordpress-plugin/ventatalk/` o similar — confirmar ruta exacta al iniciar).
> Contexto: v1.1.0 ya tiene sync en tiempo real de productos/órdenes/cupones vía hooks de WooCommerce. v1.2.0 agrega: menú propio, UI con identidad visual, validación de dominio, y `product_url` (Tracking 2.0 Fase 2b).

---

## 1. Menú de WordPress — top-level, no submenu

**Problema actual**: el plugin vive escondido dentro de "Ajustes" o similar (`add_options_page` / `add_submenu_page`).

**Fix**: usar `add_menu_page()` en el hook `admin_menu` para crear un ítem propio en el sidebar principal de WP-Admin, con ícono propio.

```php
add_action('admin_menu', function() {
    add_menu_page(
        'VentaTalk',                          // page title
        'VentaTalk',                          // menu title
        'manage_woocommerce',                 // capability (no 'manage_options' — deja fuera a roles sin acceso a tienda)
        'ventatalk',                          // menu slug
        'ventatalk_render_dashboard_page',    // callback
        'data:image/svg+xml;base64,' . base64_encode($svg_icon), // ícono inline (ver sección 2)
        58                                    // posición — justo debajo de WooCommerce (~55)
    );

    // Sub-páginas si se necesitan (ej. "Configuración", "Logs de sync")
    add_submenu_page('ventatalk', 'Configuración', 'Configuración', 'manage_woocommerce', 'ventatalk-settings', 'ventatalk_render_settings_page');
});
```

Nota: el ícono vía `data:image/svg+xml;base64,...` es el patrón recomendado por WP para íconos custom monocromáticos en el admin menu (WP lo recolorea automáticamente con `fill="black"` en el SVG).

---

## 2. Identidad visual — que no se vea "WordPress básico"

**Objetivo**: que al entrar a la página del plugin, el usuario sienta que está en "VentaTalk dentro de WordPress", no en un formulario gris estándar.

**Approach pragmático** (sin frameworks pesados, válido para WordPress.org):

1. **CSS propio encolado solo en las páginas del plugin** (`admin_enqueue_scripts`, condicional a `get_current_screen()->id === 'toplevel_page_ventatalk'`):
   - Paleta de marca VentaTalk (verde, según el branding visto en el dashboard — confirmar hex exactos del frontend Next.js, ej. `tailwind.config.js`)
   - Cards con `border-radius`, sombras suaves, tipografía con buen line-height — alejarse de tablas WP nativas
   - Header con logo VentaTalk + nombre del negocio conectado

2. **Estructura de la página principal** (`ventatalk_render_dashboard_page`):
   - Header: logo + "Conectado como: {nombre del negocio}" + badge de estado (verde "Sincronizado" / rojo "Token inválido")
   - Card de estadísticas: productos sincronizados, última sync, próxima sync automática
   - Botón grande "Sincronizar ahora" (estilo botón VentaTalk, no `button-primary` de WP)
   - Sección "Cómo funciona" con 3 pasos ilustrados (iconos simples SVG inline)

3. **Restricción importante para WordPress.org** (si se publica ahí — ver sección 5): no cargar JS/CSS desde CDN externo (`cdnjs`, Google Fonts, etc.) — todo debe estar bundleado en el plugin. Usar system fonts o una fuente incluida localmente si se quiere algo distinto a la tipografía de WP-Admin.

---

## 3. Validación de dominio — "esta cuenta pertenece a este sitio"

**Objetivo**: que un token de VentaTalk solo funcione en el dominio para el cual fue generado — evita que alguien copie/pegue un token y lo use en un sitio distinto al del negocio registrado.

### 3.1 Backend (`ventatalk` repo)

- Tabla `businesses` (o tabla de integraciones) ya debería tener o necesitar un campo `wordpress_site_url` (string, nullable).
- Endpoint nuevo o existente `POST /api/v1/integrations/woocommerce/connect` (o el que genera el token del plugin):
  - Al generar el token desde el dashboard de VentaTalk, el usuario debe ingresar la URL de su sitio WordPress (ej. `https://mpcars.cl`)
  - El token generado se asocia a ese `wordpress_site_url` en la DB

- **Middleware/validación en cada request del plugin → backend**:
  - El plugin envía el header `X-VentaTalk-Site-URL: <get_site_url()>` (o lo incluye en el payload) junto con el token
  - El backend compara ese valor contra `businesses.wordpress_site_url`:
    - Si coincide (o si `wordpress_site_url` está vacío — primera conexión, se autocompleta) → OK
    - Si NO coincide → rechazar con 403 + mensaje claro ("Este token está registrado para otro dominio")

- **Primera conexión (handshake)**: cuando el plugin se activa y el usuario pega el token por primera vez, el plugin hace un request inicial tipo `POST /api/v1/integrations/woocommerce/verify` enviando `{ token, site_url: get_site_url() }`. El backend:
  - Si `wordpress_site_url` está NULL → la guarda (primera vez, se "ata" el token a ese dominio)
  - Si ya tiene un valor y coincide → OK
  - Si ya tiene un valor y NO coincide → rechaza (el token ya está en uso en otro dominio — posible token robado/reusado)

### 3.2 Plugin (PHP)

- En la pantalla de configuración, al guardar el token, disparar el handshake (`wp_remote_post` a `/verify`)
- Mostrar el resultado: ✅ "Dominio verificado" o ❌ "Este token pertenece a otro sitio — contacta a soporte VentaTalk"
- Guardar `site_url` localmente (no es secreto, es informativo) para mostrarlo en la UI ("Conectado como: mpcars.cl")

### 3.3 Limitación honesta

Esto valida que el **plugin** que llama a la API trae un `site_url` consistente — no es una prueba criptográfica fuerte de "dueño del dominio" (alguien con el token podría falsear el header si llama directo a la API, no vía el plugin). Para el caso de uso real (evitar que un cliente comparta su token con otro negocio por error, o detectar tokens filtrados) es suficiente y proporcional. Una validación más fuerte (verificar un archivo/meta-tag en el dominio) sería sobre-ingeniería para esta etapa.

---

## 4. Tracking 2.0 Fase 2b — `product_url`

Ya está definido en `TODO.md` / contexto del proyecto: el plugin debe enviar `product_url` (permalink del producto, `get_permalink($product_id)`) en el payload de sync de productos — mismo patrón que ya funciona para Jumpseller (Fase 2a).

- Modificar el payload del hook de sync de productos (WooCommerce) para incluir `product_url`
- Sin cambios de backend esperados — la columna `catalog_items.product_url` ya existe desde la migración 008

---

## 5. ¿Publicar en WordPress.org Plugin Directory?

**Mi recomendación**: NO ahora, SÍ como visión a futuro. Razones:

- **Proceso de revisión humana**: 14 días hábiles+ de espera, y requiere 2FA en cuenta wordpress.org, cumplir Plugin Guidelines (GPL-compatible license, sin librerías externas vía CDN, todo el código visible/auditable)
- **Con 2-3 pilotos actuales**, instalar el plugin manualmente (como ya haces) es más rápido que pasar por revisión
- **Si se publica**, cualquier servicio externo que el plugin consuma (tu API) debe estar **divulgado en `readme.txt`** bajo una sección de privacidad/servicios de terceros — es aceptable (MailChimp, WooCommerce extensions, etc. lo hacen), pero es un compromiso de mantenimiento adicional (cada release pasa por SVN)

**Para HOY**: construir v1.2.0 siguiendo buenas prácticas que NO bloqueen una publicación futura (sin CDNs externos, código organizado, `readme.txt` básico desde ya) — pero distribuirlo igual que v1.1.0 (ZIP manual a cada piloto vía WordPress Admin → Plugins → Subir plugin).

**Cuando tenga sentido publicar** (post-MVP, con más pilotos / onboarding self-serve): retomar este punto, hay incluso un **MCP server de WordPress.org** (`make.wordpress.org` lo lanzó en 2026) que permite a Claude/agentes IA validar `readme.txt` y hacer el submission directo — facilitaría mucho el proceso cuando llegue el momento.

---

## 6. Orden de ejecución sugerido

1. Backend: agregar campo `wordpress_site_url` (migración) + endpoint `/verify` + validación de dominio en middleware de requests del plugin
2. Plugin: menú top-level (`add_menu_page`) + página de dashboard con nueva UI
3. Plugin: CSS propio con branding VentaTalk (confirmar paleta de colores del frontend antes de empezar)
4. Plugin: handshake de verificación de dominio en pantalla de configuración
5. Plugin: agregar `product_url` al payload de sync (Fase 2b)
6. Bump versión a 1.2.0, actualizar `readme.txt` con changelog
7. Generar ZIP, probar instalación limpia en un WordPress de prueba (o directo en uno de los 2 pilotos que requieren reinstalación: MP Cars o clínica cosmética)