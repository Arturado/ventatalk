<?php
if ( ! defined( 'ABSPATH' ) ) exit;

// ── Opciones por defecto ───────────────────────────────────────────────────────

function ventatalk_default_options() {
    return [
        'widget_type'   => 'whatsapp',
        'phone'         => '',
        'business_name' => get_bloginfo( 'name' ),
        'greeting'      => '¡Hola! 👋 ¿En qué puedo ayudarte hoy?',
        'message'       => '[WEB] Hola, vengo desde el sitio web y quiero consultar.',
        'color'         => '#16a34a',
        'position'      => 'right',
        'delay'         => 2,
        // Catálogo
        'api_token'     => '',
        'api_url'       => 'https://api.ventatalk.com',
    ];
}

function ventatalk_get_options() {
    $saved    = get_option( 'ventatalk_options', [] );
    $defaults = ventatalk_default_options();
    return wp_parse_args( $saved, $defaults );
}

// ── Registrar settings ────────────────────────────────────────────────────────

add_action( 'admin_init', 'ventatalk_register_settings' );

function ventatalk_register_settings() {
    register_setting( 'ventatalk_group', 'ventatalk_options', [
        'sanitize_callback' => 'ventatalk_sanitize_options',
    ] );

    // ── Sección: Tipo de widget ──
    add_settings_section(
        'ventatalk_widget_type',
        'Widget',
        '__return_false',
        'ventatalk'
    );

    add_settings_field(
        'ventatalk_widget_type_field',
        'Tipo de widget',
        'ventatalk_render_widget_type_field',
        'ventatalk',
        'ventatalk_widget_type'
    );

    // ── Sección: Widget WhatsApp ──
    add_settings_section(
        'ventatalk_main',
        'Widget de WhatsApp',
        '__return_false',
        'ventatalk'
    );

    $widget_fields = [
        [ 'id' => 'phone',         'label' => 'Número WhatsApp',      'type' => 'text',     'placeholder' => '+56912345678',              'desc' => 'Con código de país. Ej: +56912345678' ],
        [ 'id' => 'business_name', 'label' => 'Nombre del negocio',   'type' => 'text',     'placeholder' => 'Mi Negocio',                'desc' => 'Se muestra en el popup del widget.' ],
        [ 'id' => 'greeting',      'label' => 'Mensaje de bienvenida','type' => 'text',     'placeholder' => '¡Hola! ¿En qué te ayudo?',  'desc' => 'Aparece en el popup antes de abrir WhatsApp.' ],
        [ 'id' => 'message',       'label' => 'Mensaje pre-escrito',  'type' => 'textarea', 'placeholder' => '',                          'desc' => 'Texto que se envía automáticamente al abrir WhatsApp. El prefijo [WEB] identifica el origen en el dashboard.' ],
        [ 'id' => 'color',         'label' => 'Color del botón',      'type' => 'color',    'placeholder' => '#16a34a',                   'desc' => 'Color principal del widget.' ],
        [ 'id' => 'position',      'label' => 'Posición',             'type' => 'select',   'options' => [ 'right' => 'Derecha', 'left' => 'Izquierda' ], 'desc' => '' ],
        [ 'id' => 'delay',         'label' => 'Demora de aparición',  'type' => 'number',   'placeholder' => '2',                         'desc' => 'Segundos antes de mostrar el widget (0 = inmediato).' ],
    ];

    foreach ( $widget_fields as $f ) {
        add_settings_field(
            'ventatalk_' . $f['id'],
            $f['label'],
            'ventatalk_render_field',
            'ventatalk',
            'ventatalk_main',
            $f
        );
    }

    // ── Sección: Catálogo / VentaTalk API ──
    add_settings_section(
        'ventatalk_catalog',
        'Sincronización de catálogo',
        'ventatalk_catalog_section_desc',
        'ventatalk'
    );

    $catalog_fields = [
        [ 'id' => 'api_token', 'label' => 'Token de API VentaTalk', 'type' => 'password', 'placeholder' => 'vt_wc_...', 'desc' => 'Genera este token en VentaTalk Dashboard → Integraciones → WordPress / WooCommerce.' ],
        [ 'id' => 'api_url',   'label' => 'URL del servidor',       'type' => 'text',     'placeholder' => 'https://api.ventatalk.com',  'desc' => 'No cambies esto a menos que tu cuenta use un servidor personalizado.' ],
    ];

    foreach ( $catalog_fields as $f ) {
        add_settings_field(
            'ventatalk_' . $f['id'],
            $f['label'],
            'ventatalk_render_field',
            'ventatalk',
            'ventatalk_catalog',
            $f
        );
    }
}

function ventatalk_catalog_section_desc() {
    echo '<p style="color:#555;font-size:13px;">Conecta tu catálogo de WooCommerce con VentaTalk para que el agente IA conozca tus productos y precios.</p>';
}

function ventatalk_render_widget_type_field() {
    $opts        = ventatalk_get_options();
    $widget_type = $opts['widget_type'] ?? 'whatsapp';
    ?>
    <div class="vt-type-toggle">
        <label class="vt-type-option<?php echo $widget_type === 'whatsapp' ? ' vt-type-selected' : ''; ?>">
            <input
                type="radio"
                name="ventatalk_options[widget_type]"
                value="whatsapp"
                <?php checked( $widget_type, 'whatsapp' ); ?>
            >
            <div class="vt-type-card">
                <div class="vt-type-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                </div>
                <div class="vt-type-name">WhatsApp</div>
                <div class="vt-type-badge vt-badge-active">Activo</div>
            </div>
        </label>
        <label class="vt-type-option vt-type-disabled">
            <input type="radio" name="ventatalk_options[widget_type]" value="webchat" disabled>
            <div class="vt-type-card">
                <div class="vt-type-icon">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="vt-type-name">Chat Web</div>
                <div class="vt-type-badge vt-badge-soon">Próximamente</div>
            </div>
        </label>
    </div>
    <style>
    .vt-type-toggle {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    .vt-type-option {
        cursor: pointer;
        display: block;
    }
    .vt-type-option input[type="radio"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }
    .vt-type-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 16px 24px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
        min-width: 120px;
        transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .vt-type-option:not(.vt-type-disabled):hover .vt-type-card {
        border-color: #16a34a;
    }
    .vt-type-selected .vt-type-card {
        border-color: #16a34a;
        box-shadow: 0 0 0 3px rgba(22,163,74,.12);
    }
    .vt-type-icon {
        color: #374151;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
    }
    .vt-type-selected .vt-type-icon { color: #16a34a; }
    .vt-type-disabled .vt-type-icon { color: #d1d5db; }
    .vt-type-name {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
    }
    .vt-type-disabled .vt-type-name { color: #9ca3af; }
    .vt-type-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 99px;
        text-transform: uppercase;
        letter-spacing: .04em;
    }
    .vt-badge-active {
        background: #dcfce7;
        color: #15803d;
    }
    .vt-badge-soon {
        background: #f3f4f6;
        color: #9ca3af;
    }
    .vt-type-disabled {
        cursor: default;
    }
    .vt-type-disabled .vt-type-card {
        background: #fafafa;
    }
    </style>
    <?php
}

function ventatalk_render_field( $field ) {
    $opts  = ventatalk_get_options();
    $id    = esc_attr( $field['id'] );
    $val   = isset( $opts[ $id ] ) ? $opts[ $id ] : '';
    $name  = "ventatalk_options[{$id}]";

    switch ( $field['type'] ) {
        case 'textarea':
            printf(
                '<textarea id="%s" name="%s" rows="3" style="width:100%%;max-width:500px;">%s</textarea>',
                $id, esc_attr( $name ), esc_textarea( $val )
            );
            break;
        case 'select':
            $html = "<select id=\"{$id}\" name=\"" . esc_attr( $name ) . "\">";
            foreach ( $field['options'] as $k => $label ) {
                $sel   = selected( $val, $k, false );
                $html .= "<option value=\"{$k}\" {$sel}>{$label}</option>";
            }
            $html .= '</select>';
            echo $html;
            break;
        case 'color':
            printf(
                '<input type="color" id="%s" name="%s" value="%s">',
                $id, esc_attr( $name ), esc_attr( $val ?: '#16a34a' )
            );
            break;
        case 'number':
            printf(
                '<input type="number" id="%s" name="%s" value="%s" min="0" max="30" style="width:80px">',
                $id, esc_attr( $name ), esc_attr( $val )
            );
            break;
        case 'password':
            printf(
                '<input type="password" id="%s" name="%s" value="%s" placeholder="%s" autocomplete="new-password" style="width:100%%;max-width:500px;">',
                $id, esc_attr( $name ), esc_attr( $val ), esc_attr( $field['placeholder'] ?? '' )
            );
            break;
        default:
            printf(
                '<input type="text" id="%s" name="%s" value="%s" placeholder="%s" style="width:100%%;max-width:500px;">',
                $id, esc_attr( $name ), esc_attr( $val ), esc_attr( $field['placeholder'] ?? '' )
            );
    }

    if ( ! empty( $field['desc'] ) ) {
        printf( '<p class="description">%s</p>', esc_html( $field['desc'] ) );
    }
}

function ventatalk_sanitize_options( $input ) {
    $clean = [];
    $clean['widget_type']   = in_array( $input['widget_type'] ?? '', [ 'whatsapp', 'webchat' ] ) ? $input['widget_type'] : 'whatsapp';
    $clean['phone']         = sanitize_text_field( $input['phone'] ?? '' );
    $clean['business_name'] = sanitize_text_field( $input['business_name'] ?? '' );
    $clean['greeting']      = sanitize_text_field( $input['greeting'] ?? '' );
    $clean['message']       = sanitize_textarea_field( $input['message'] ?? '' );
    $clean['color']         = sanitize_hex_color( $input['color'] ?? '#16a34a' ) ?: '#16a34a';
    $clean['position']      = in_array( $input['position'] ?? '', [ 'right', 'left' ] ) ? $input['position'] : 'right';
    $clean['delay']         = max( 0, min( 30, intval( $input['delay'] ?? 2 ) ) );
    $clean['api_token']     = sanitize_text_field( $input['api_token'] ?? '' );
    $clean['api_url']       = esc_url_raw( $input['api_url'] ?? 'https://api.ventatalk.com' );
    return $clean;
}

// ── Helper: construir payload de un producto ──────────────────────────────────

function ventatalk_build_product_payload( WC_Product $product ) {
    $price = $product->get_price();
    return [
        'external_id'  => (string) $product->get_id(),
        'name'         => $product->get_name(),
        'description'  => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
        'price'        => $price !== '' ? (float) $price : null,
        'category'     => implode( ', ', wp_list_pluck( $product->get_category_ids() ? get_terms( [
            'taxonomy' => 'product_cat',
            'include'  => $product->get_category_ids(),
            'fields'   => 'names',
        ] ) : [], 'name' ) ),
        'image_url'    => wp_get_attachment_url( $product->get_image_id() ) ?: null,
        'is_available' => $product->is_in_stock(),
    ];
}

// ── WooCommerce: sincronización de un producto individual ─────────────────────

function ventatalk_push_single_product( $product_id ) {
    $opts      = ventatalk_get_options();
    $api_token = $opts['api_token'] ?? '';
    if ( empty( $api_token ) ) return;

    if ( ! class_exists( 'WooCommerce' ) ) return;

    $product = wc_get_product( $product_id );
    if ( ! $product || $product->get_status() !== 'publish' ) return;

    $api_url = rtrim( $opts['api_url'] ?? 'https://api.ventatalk.com', '/' );

    wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/ingest', [
        'timeout' => 5,
        'headers' => [
            'Content-Type'      => 'application/json',
            'X-VentaTalk-Token' => $api_token,
        ],
        'body' => wp_json_encode( [
            'products'  => [ ventatalk_build_product_payload( $product ) ],
            'store_url' => get_site_url(),
        ] ),
    ] );
}

// ── Hooks WooCommerce para sincronización en tiempo real ──────────────────────

// Producto guardado/actualizado en el admin o vía API
add_action( 'woocommerce_update_product', 'ventatalk_woo_on_update_product', 20, 2 );

function ventatalk_woo_on_update_product( $product_id, $product ) {
    ventatalk_push_single_product( $product_id );
}

// Stock actualizado (vía wc_update_product_stock o gestor de pedidos)
add_action( 'woocommerce_product_set_stock', 'ventatalk_woo_on_set_stock', 20, 1 );

function ventatalk_woo_on_set_stock( $product ) {
    if ( $product instanceof WC_Product ) {
        ventatalk_push_single_product( $product->get_id() );
    }
}

// Precio actualizado programáticamente
add_action( 'woocommerce_product_set_price', 'ventatalk_woo_on_set_price', 20, 1 );

function ventatalk_woo_on_set_price( $product ) {
    if ( $product instanceof WC_Product ) {
        ventatalk_push_single_product( $product->get_id() );
    }
}

// ── AJAX: sincronizar catálogo WooCommerce → VentaTalk ────────────────────────

add_action( 'wp_ajax_ventatalk_sync_catalog', 'ventatalk_ajax_sync_catalog' );

function ventatalk_ajax_sync_catalog() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( [ 'message' => 'Sin permisos.' ], 403 );
    }

    check_ajax_referer( 'ventatalk_sync_nonce', 'nonce' );

    $opts      = ventatalk_get_options();
    $api_token = $opts['api_token'] ?? '';
    $api_url   = rtrim( $opts['api_url'] ?? 'https://api.ventatalk.com', '/' );

    if ( empty( $api_token ) ) {
        wp_send_json_error( [ 'message' => 'Configura el token de API VentaTalk primero.' ] );
    }

    if ( ! class_exists( 'WooCommerce' ) ) {
        wp_send_json_error( [ 'message' => 'WooCommerce no está activo.' ] );
    }

    $products = wc_get_products( [
        'status' => 'publish',
        'limit'  => -1,
        'type'   => [ 'simple', 'variable' ],
        'return' => 'objects',
    ] );

    if ( empty( $products ) ) {
        wp_send_json_error( [ 'message' => 'No se encontraron productos publicados en WooCommerce.' ] );
    }

    $payload = [];
    foreach ( $products as $product ) {
        $payload[] = ventatalk_build_product_payload( $product );
    }

    $response = wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/ingest', [
        'timeout' => 30,
        'headers' => [
            'Content-Type'      => 'application/json',
            'X-VentaTalk-Token' => $api_token,
        ],
        'body' => wp_json_encode( [
            'products'  => $payload,
            'store_url' => get_site_url(),
        ] ),
    ] );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( [ 'message' => 'Error de conexión: ' . $response->get_error_message() ] );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $body = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( $code === 401 ) {
        wp_send_json_error( [ 'message' => 'Token inválido. Genera uno nuevo en VentaTalk Dashboard.' ] );
    }

    if ( $code !== 200 ) {
        wp_send_json_error( [ 'message' => 'Error del servidor VentaTalk (HTTP ' . $code . ').' ] );
    }

    wp_send_json_success( [
        'message' => sprintf(
            'Sincronización exitosa: %d productos nuevos, %d actualizados.',
            intval( $body['created'] ?? 0 ),
            intval( $body['updated'] ?? 0 )
        ),
        'total' => intval( $body['total'] ?? 0 ),
    ] );
}

// ── Página de settings en el admin ────────────────────────────────────────────

add_action( 'admin_menu', 'ventatalk_admin_menu' );

function ventatalk_admin_menu() {
    add_options_page(
        'VentaTalk Widget',
        'VentaTalk',
        'manage_options',
        'ventatalk',
        'ventatalk_render_settings_page'
    );
}

function ventatalk_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $opts      = ventatalk_get_options();
    $phone     = preg_replace( '/[^0-9]/', '', $opts['phone'] );
    $has_token = ! empty( $opts['api_token'] );
    $nonce     = wp_create_nonce( 'ventatalk_sync_nonce' );
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:10px;">
            <span style="background:#16a34a;color:white;padding:6px 10px;border-radius:8px;font-size:14px;">VentaTalk</span>
            Chat Widget
        </h1>

        <?php if ( ! empty( $phone ) ) : ?>
        <div class="notice notice-success" style="padding:10px 16px;margin:12px 0;">
            <strong>Widget activo.</strong> Tus visitantes pueden iniciar conversaciones en WhatsApp.
            <a href="https://wa.me/<?php echo esc_attr( $phone ); ?>" target="_blank" style="margin-left:10px;">Probar enlace →</a>
        </div>
        <?php else : ?>
        <div class="notice notice-warning" style="padding:10px 16px;margin:12px 0;">
            <strong>Ingresa un número de WhatsApp</strong> para activar el widget.
        </div>
        <?php endif; ?>

        <form method="post" action="options.php" style="max-width:620px;">
            <?php
            settings_fields( 'ventatalk_group' );
            do_settings_sections( 'ventatalk' );
            submit_button( 'Guardar cambios' );
            ?>
        </form>

        <?php if ( $has_token ) : ?>
        <hr style="margin:32px 0;">
        <h2>Sincronizar catálogo con VentaTalk</h2>
        <p style="color:#555;max-width:540px;">
            Envía todos los productos publicados de tu tienda WooCommerce a VentaTalk para que el agente IA los conozca.
            La sincronización automática en tiempo real está activa — este botón es para una sincronización completa manual.
        </p>
        <p id="ventatalk-sync-result" style="display:none;padding:10px 16px;border-radius:6px;margin:12px 0;max-width:540px;"></p>
        <button
            id="ventatalk-sync-btn"
            class="button button-primary"
            style="display:flex;align-items:center;gap:8px;"
            data-nonce="<?php echo esc_attr( $nonce ); ?>"
            data-ajax="<?php echo esc_attr( admin_url( 'admin-ajax.php' ) ); ?>"
        >
            <span class="dashicons dashicons-update" style="margin-top:3px;"></span>
            Sincronizar catálogo ahora
        </button>
        <p style="color:#888;font-size:12px;margin-top:8px;">
            <?php
            $count = count( wc_get_products( [ 'status' => 'publish', 'limit' => -1, 'return' => 'ids' ] ) );
            echo esc_html( $count ) . ' producto' . ( $count !== 1 ? 's' : '' ) . ' publicado' . ( $count !== 1 ? 's' : '' ) . ' en tu tienda.';
            ?>
        </p>
        <script>
        (function () {
            var btn    = document.getElementById('ventatalk-sync-btn');
            var result = document.getElementById('ventatalk-sync-result');
            if (!btn) return;

            btn.addEventListener('click', function () {
                btn.disabled = true;
                btn.innerHTML = '<span class="dashicons dashicons-update" style="margin-top:3px;animation:rotation 1s linear infinite;"></span> Sincronizando...';
                result.style.display = 'none';

                var form = new FormData();
                form.append('action', 'ventatalk_sync_catalog');
                form.append('nonce',  btn.dataset.nonce);

                fetch(btn.dataset.ajax, { method: 'POST', body: form })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        result.style.display = 'block';
                        if (data.success) {
                            result.style.background = '#ecfdf5';
                            result.style.border      = '1px solid #6ee7b7';
                            result.style.color       = '#065f46';
                            result.textContent = '✓ ' + data.data.message;
                        } else {
                            result.style.background = '#fef2f2';
                            result.style.border      = '1px solid #fca5a5';
                            result.style.color       = '#991b1b';
                            result.textContent = '✗ ' + data.data.message;
                        }
                    })
                    .catch(function() {
                        result.style.display     = 'block';
                        result.style.background  = '#fef2f2';
                        result.style.border      = '1px solid #fca5a5';
                        result.style.color       = '#991b1b';
                        result.textContent = '✗ Error de red. Verifica tu conexión e intenta de nuevo.';
                    })
                    .finally(function() {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="dashicons dashicons-update" style="margin-top:3px;"></span> Sincronizar catálogo ahora';
                    });
            });
        })();
        </script>
        <style>
        @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
        <?php endif; ?>

        <?php if ( ! empty( $phone ) ) : ?>
        <hr style="margin:32px 0;">
        <h2>Shortcode</h2>
        <p>Inserta el widget en cualquier página o entrada:</p>
        <code style="font-size:16px;padding:8px 14px;background:#f0f0f0;border-radius:6px;display:inline-block;">[ventatalk_chat]</code>
        <p style="color:#666;font-size:13px;margin-top:8px;">
            Si no usas el shortcode, el botón flotante aparece automáticamente en todas las páginas.
        </p>
        <?php endif; ?>
    </div>
    <?php
}
