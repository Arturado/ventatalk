<?php
if ( ! defined( 'ABSPATH' ) ) exit;

// ── Opciones por defecto ───────────────────────────────────────────────────────

function ventabot_default_options() {
    return [
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

function ventabot_get_options() {
    $saved    = get_option( 'ventabot_options', [] );
    $defaults = ventabot_default_options();
    return wp_parse_args( $saved, $defaults );
}

// ── Registrar settings ────────────────────────────────────────────────────────

add_action( 'admin_init', 'ventabot_register_settings' );

function ventabot_register_settings() {
    register_setting( 'ventabot_group', 'ventabot_options', [
        'sanitize_callback' => 'ventabot_sanitize_options',
    ] );

    // ── Sección: Widget WhatsApp ──
    add_settings_section(
        'ventabot_main',
        'Widget de WhatsApp',
        '__return_false',
        'ventabot'
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
            'ventabot_' . $f['id'],
            $f['label'],
            'ventabot_render_field',
            'ventabot',
            'ventabot_main',
            $f
        );
    }

    // ── Sección: Catálogo / VentaTalk API ──
    add_settings_section(
        'ventabot_catalog',
        'Sincronización de catálogo',
        'ventabot_catalog_section_desc',
        'ventabot'
    );

    $catalog_fields = [
        [ 'id' => 'api_token', 'label' => 'Token de API VentaTalk', 'type' => 'password', 'placeholder' => 'vt_wc_...', 'desc' => 'Genera este token en VentaTalk Dashboard → Integraciones → WordPress / WooCommerce.' ],
        [ 'id' => 'api_url',   'label' => 'URL del servidor',       'type' => 'text',     'placeholder' => 'https://api.ventatalk.com',  'desc' => 'No cambies esto a menos que tu cuenta use un servidor personalizado.' ],
    ];

    foreach ( $catalog_fields as $f ) {
        add_settings_field(
            'ventabot_' . $f['id'],
            $f['label'],
            'ventabot_render_field',
            'ventabot',
            'ventabot_catalog',
            $f
        );
    }
}

function ventabot_catalog_section_desc() {
    echo '<p style="color:#555;font-size:13px;">Conecta tu catálogo de WooCommerce con VentaTalk para que el agente IA conozca tus productos y precios.</p>';
}

function ventabot_render_field( $field ) {
    $opts  = ventabot_get_options();
    $id    = esc_attr( $field['id'] );
    $val   = isset( $opts[ $id ] ) ? $opts[ $id ] : '';
    $name  = "ventabot_options[{$id}]";

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

function ventabot_sanitize_options( $input ) {
    $clean = [];
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

// ── AJAX: sincronizar catálogo WooCommerce → VentaTalk ────────────────────────

add_action( 'wp_ajax_ventabot_sync_catalog', 'ventabot_ajax_sync_catalog' );

function ventabot_ajax_sync_catalog() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( [ 'message' => 'Sin permisos.' ], 403 );
    }

    check_ajax_referer( 'ventabot_sync_nonce', 'nonce' );

    $opts      = ventabot_get_options();
    $api_token = $opts['api_token'] ?? '';
    $api_url   = rtrim( $opts['api_url'] ?? 'https://api.ventatalk.com', '/' );

    if ( empty( $api_token ) ) {
        wp_send_json_error( [ 'message' => 'Configura el token de API VentaTalk primero.' ] );
    }

    if ( ! class_exists( 'WooCommerce' ) ) {
        wp_send_json_error( [ 'message' => 'WooCommerce no está activo.' ] );
    }

    // Obtener productos publicados de WooCommerce
    $args = [
        'status'         => 'publish',
        'limit'          => -1,
        'type'           => [ 'simple', 'variable' ],
        'return'         => 'objects',
    ];

    $products     = wc_get_products( $args );
    $payload      = [];
    $store_url    = get_site_url();

    foreach ( $products as $product ) {
        /** @var WC_Product $product */
        $price = $product->get_price();

        $payload[] = [
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

    if ( empty( $payload ) ) {
        wp_send_json_error( [ 'message' => 'No se encontraron productos publicados en WooCommerce.' ] );
    }

    // Enviar a VentaTalk
    $response = wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/ingest', [
        'timeout' => 30,
        'headers' => [
            'Content-Type'      => 'application/json',
            'X-VentaTalk-Token' => $api_token,
        ],
        'body' => wp_json_encode( [
            'products'  => $payload,
            'store_url' => $store_url,
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

add_action( 'admin_menu', 'ventabot_admin_menu' );

function ventabot_admin_menu() {
    add_options_page(
        'VentaTalk Widget',
        'VentaTalk',
        'manage_options',
        'ventabot',
        'ventabot_render_settings_page'
    );
}

function ventabot_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $opts      = ventabot_get_options();
    $phone     = preg_replace( '/[^0-9]/', '', $opts['phone'] );
    $has_token = ! empty( $opts['api_token'] );
    $nonce     = wp_create_nonce( 'ventabot_sync_nonce' );
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
            settings_fields( 'ventabot_group' );
            do_settings_sections( 'ventabot' );
            submit_button( 'Guardar cambios' );
            ?>
        </form>

        <?php if ( $has_token ) : ?>
        <hr style="margin:32px 0;">
        <h2>Sincronizar catálogo con VentaTalk</h2>
        <p style="color:#555;max-width:540px;">
            Envía todos los productos publicados de tu tienda WooCommerce a VentaTalk para que el agente IA los conozca.
        </p>
        <p id="ventabot-sync-result" style="display:none;padding:10px 16px;border-radius:6px;margin:12px 0;max-width:540px;"></p>
        <button
            id="ventabot-sync-btn"
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
            var btn    = document.getElementById('ventabot-sync-btn');
            var result = document.getElementById('ventabot-sync-result');
            if (!btn) return;

            btn.addEventListener('click', function () {
                btn.disabled = true;
                btn.innerHTML = '<span class="dashicons dashicons-update" style="margin-top:3px;animation:rotation 1s linear infinite;"></span> Sincronizando...';
                result.style.display = 'none';

                var form = new FormData();
                form.append('action', 'ventabot_sync_catalog');
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
        <code style="font-size:16px;padding:8px 14px;background:#f0f0f0;border-radius:6px;display:inline-block;">[ventabot_chat]</code>
        <p style="color:#666;font-size:13px;margin-top:8px;">
            Si no usas el shortcode, el botón flotante aparece automáticamente en todas las páginas.
        </p>
        <?php endif; ?>
    </div>
    <?php
}
