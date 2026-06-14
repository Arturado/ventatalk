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
        'api_token'      => '',
        'api_url'        => 'https://api.ventatalk.com',
        // Verificación de dominio (v1.2.0)
        'domain_status'  => '',   // 'verified' | 'error' | 'error_token' | ''
        'domain_site_url' => '',  // URL bloqueada tras primer handshake
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
    $old   = get_option( 'ventatalk_options', [] );
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

    // Preservar campos de dominio por defecto
    $clean['domain_status']   = $old['domain_status']   ?? '';
    $clean['domain_site_url'] = $old['domain_site_url'] ?? '';

    // Token vacío → limpiar verificación
    if ( empty( $clean['api_token'] ) ) {
        $clean['domain_status']   = '';
        $clean['domain_site_url'] = '';
        return $clean;
    }

    // Token nuevo → disparar handshake de dominio
    $old_token = $old['api_token'] ?? '';
    if ( $clean['api_token'] !== $old_token ) {
        $api_url  = rtrim( $clean['api_url'], '/' );
        $site_url = get_site_url();

        $response = wp_remote_post(
            $api_url . '/api/v1/integrations/woocommerce/verify',
            [
                'timeout' => 10,
                'headers' => [
                    'Content-Type'      => 'application/json',
                    'X-VentaTalk-Token' => $clean['api_token'],
                ],
                'body' => wp_json_encode( [ 'site_url' => $site_url ] ),
            ]
        );

        if ( is_wp_error( $response ) ) {
            $clean['domain_status']   = 'error';
            $clean['domain_site_url'] = '';
        } else {
            $code = wp_remote_retrieve_response_code( $response );
            $body = json_decode( wp_remote_retrieve_body( $response ), true );

            if ( $code === 200 ) {
                $clean['domain_status']   = 'verified';
                $clean['domain_site_url'] = $body['wordpress_site_url'] ?? $site_url;
            } elseif ( $code === 401 ) {
                $clean['domain_status']   = 'error_token';
                $clean['domain_site_url'] = '';
            } else {
                // 403 = token ya atado a otro dominio
                $clean['domain_status']   = 'error';
                $clean['domain_site_url'] = '';
                $detail = $body['detail'] ?? 'Este token pertenece a otro sitio. Genera un nuevo token en VentaTalk Dashboard.';
                add_settings_error( 'ventatalk_options', 'domain_mismatch', esc_html( $detail ), 'error' );
            }
        }
    }

    return $clean;
}

// ── Helper: construir payload de un producto ──────────────────────────────────

function ventatalk_build_product_payload( WC_Product $product ) {
    $price = $product->get_price();

    // Stock quantity: null when manage_stock is disabled.
    if ( $product->is_type( 'variable' ) ) {
        $total       = 0;
        $any_managed = false;
        foreach ( $product->get_children() as $child_id ) {
            $variation = wc_get_product( $child_id );
            if ( $variation && $variation->get_manage_stock() ) {
                $any_managed = true;
                $total      += (int) $variation->get_stock_quantity();
            }
        }
        $stock_quantity = $any_managed ? $total : null;
    } else {
        $stock_quantity = $product->get_manage_stock() ? (int) $product->get_stock_quantity() : null;
    }

    // Image URL: main image → first gallery image → null.
    $image_id = $product->get_image_id();
    if ( $image_id ) {
        $image_url = wp_get_attachment_url( $image_id ) ?: null;
    } else {
        $gallery   = $product->get_gallery_image_ids();
        $image_url = ! empty( $gallery ) ? ( wp_get_attachment_url( $gallery[0] ) ?: null ) : null;
    }

    return [
        'external_id'    => (string) $product->get_id(),
        'name'           => $product->get_name(),
        'description'    => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
        'price'          => $price !== '' ? (float) $price : null,
        'category'       => implode( ', ', wp_list_pluck( $product->get_category_ids() ? get_terms( [
            'taxonomy' => 'product_cat',
            'include'  => $product->get_category_ids(),
            'fields'   => 'names',
        ] ) : [], 'name' ) ),
        'image_url'      => $image_url,
        'stock_quantity' => $stock_quantity,
        'sku'            => $product->get_sku() !== '' ? $product->get_sku() : null,
        'is_available'   => $product->is_in_stock(),
        'product_url'    => get_permalink( $product->get_id() ),
    ];
}

// ── Helper: construir payload de una orden ────────────────────────────────────

function ventatalk_build_order_payload( $order_id ) {
    $order = wc_get_order( $order_id );
    if ( ! $order ) return null;

    $items = [];
    foreach ( $order->get_items() as $item ) {
        $product = $item->get_product();
        $items[] = [
            'name'  => $item->get_name(),
            'qty'   => $item->get_quantity(),
            'price' => (float) $item->get_total(),
            'sku'   => $product ? $product->get_sku() : '',
        ];
    }

    $customer_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ) ?: null;
    $date_created  = $order->get_date_created();

    return [
        'external_id'    => (string) $order->get_id(),
        'order_number'   => $order->get_order_number(),
        'status'         => $order->get_status(),
        'total'          => (float) $order->get_total(),
        'currency'       => $order->get_currency(),
        'payment_method' => $order->get_payment_method_title() ?: null,
        'customer_name'  => $customer_name,
        'customer_email' => $order->get_billing_email() ?: null,
        'customer_phone' => $order->get_billing_phone() ?: null,
        'items'          => $items,
        'notes'          => $order->get_customer_note() ?: null,
        'ordered_at'     => $date_created ? $date_created->format( 'c' ) : null,
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

// ── WooCommerce: sincronización de una orden individual ──────────────────────

function ventatalk_push_single_order( $order_id ) {
    $opts      = ventatalk_get_options();
    $api_token = $opts['api_token'] ?? '';
    if ( empty( $api_token ) ) return;

    if ( ! class_exists( 'WooCommerce' ) ) return;

    $payload = ventatalk_build_order_payload( $order_id );
    if ( ! $payload ) return;

    $api_url = rtrim( $opts['api_url'] ?? 'https://api.ventatalk.com', '/' );

    wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/orders/ingest', [
        'timeout' => 5,
        'headers' => [
            'Content-Type'      => 'application/json',
            'X-VentaTalk-Token' => $api_token,
        ],
        'body' => wp_json_encode( [
            'orders'    => [ $payload ],
            'store_url' => get_site_url(),
        ] ),
    ] );
}

// ── Helper: construir payload de un cupón ─────────────────────────────────────

function ventatalk_build_coupon_payload( $coupon_id ) {
    $coupon = new WC_Coupon( $coupon_id );

    $date_expires = $coupon->get_date_expires();
    $expires_at   = $date_expires ? $date_expires->format( 'c' ) : null;

    $minimum = $coupon->get_minimum_amount();

    return [
        'external_id'      => (string) $coupon_id,
        'code'             => $coupon->get_code(),
        'discount_type'    => $coupon->get_discount_type(),
        'discount_value'   => (float) $coupon->get_amount(),
        'description'      => $coupon->get_description() ?: null,
        'min_order_amount' => ( $minimum !== '' && $minimum !== null ) ? (float) $minimum : null,
        'usage_count'      => (int) $coupon->get_usage_count(),
        'usage_limit'      => $coupon->get_usage_limit() ? (int) $coupon->get_usage_limit() : null,
        'expires_at'       => $expires_at,
        'is_active'        => get_post_status( $coupon_id ) === 'publish',
    ];
}

// ── WooCommerce: sincronización de un cupón individual ───────────────────────

function ventatalk_push_single_coupon( $coupon_id ) {
    $opts      = ventatalk_get_options();
    $api_token = $opts['api_token'] ?? '';
    if ( empty( $api_token ) ) return;

    if ( ! class_exists( 'WooCommerce' ) ) return;

    $api_url = rtrim( $opts['api_url'] ?? 'https://api.ventatalk.com', '/' );

    wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/coupons/ingest', [
        'timeout' => 5,
        'headers' => [
            'Content-Type'      => 'application/json',
            'X-VentaTalk-Token' => $api_token,
        ],
        'body' => wp_json_encode( [
            'coupons'   => [ ventatalk_build_coupon_payload( $coupon_id ) ],
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

// ── Hooks WooCommerce para sincronización de órdenes en tiempo real ───────────

add_action( 'woocommerce_new_order', 'ventatalk_woo_on_new_order', 20, 1 );

function ventatalk_woo_on_new_order( $order_id ) {
    ventatalk_push_single_order( $order_id );
}

add_action( 'woocommerce_order_status_changed', 'ventatalk_woo_on_order_status_changed', 20, 1 );

function ventatalk_woo_on_order_status_changed( $order_id ) {
    ventatalk_push_single_order( $order_id );
}

// ── Hooks WooCommerce para sincronización de cupones en tiempo real ───────────

add_action( 'woocommerce_coupon_options_save', 'ventatalk_woo_on_coupon_save', 20, 1 );

function ventatalk_woo_on_coupon_save( $coupon_id ) {
    ventatalk_push_single_coupon( $coupon_id );
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

    $products_created = intval( $body['created'] ?? 0 );
    $products_updated = intval( $body['updated'] ?? 0 );

    // ── Sincronizar órdenes ──
    $orders_synced = 0;
    $all_orders    = wc_get_orders( [ 'limit' => -1, 'status' => 'any' ] );

    if ( ! empty( $all_orders ) ) {
        $order_payloads = [];
        foreach ( $all_orders as $order ) {
            $p = ventatalk_build_order_payload( $order->get_id() );
            if ( $p ) {
                $order_payloads[] = $p;
            }
        }

        foreach ( array_chunk( $order_payloads, 50 ) as $batch ) {
            $order_resp = wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/orders/ingest', [
                'timeout' => 30,
                'headers' => [
                    'Content-Type'      => 'application/json',
                    'X-VentaTalk-Token' => $api_token,
                ],
                'body' => wp_json_encode( [
                    'orders'    => $batch,
                    'store_url' => get_site_url(),
                ] ),
            ] );

            if ( ! is_wp_error( $order_resp ) && wp_remote_retrieve_response_code( $order_resp ) === 200 ) {
                $order_body     = json_decode( wp_remote_retrieve_body( $order_resp ), true );
                $orders_synced += intval( $order_body['total'] ?? 0 );
            }
        }
    }

    // ── Sincronizar cupones ──
    $coupons_synced = 0;
    $all_coupons    = get_posts( [ 'post_type' => 'shop_coupon', 'numberposts' => -1, 'post_status' => 'publish' ] );

    if ( ! empty( $all_coupons ) ) {
        $coupon_payloads = [];
        foreach ( $all_coupons as $coupon_post ) {
            $coupon_payloads[] = ventatalk_build_coupon_payload( $coupon_post->ID );
        }

        foreach ( array_chunk( $coupon_payloads, 50 ) as $batch ) {
            $coupon_resp = wp_remote_post( $api_url . '/api/v1/integrations/woocommerce/coupons/ingest', [
                'timeout' => 30,
                'headers' => [
                    'Content-Type'      => 'application/json',
                    'X-VentaTalk-Token' => $api_token,
                ],
                'body' => wp_json_encode( [
                    'coupons'   => $batch,
                    'store_url' => get_site_url(),
                ] ),
            ] );

            if ( ! is_wp_error( $coupon_resp ) && wp_remote_retrieve_response_code( $coupon_resp ) === 200 ) {
                $coupon_body     = json_decode( wp_remote_retrieve_body( $coupon_resp ), true );
                $coupons_synced += intval( $coupon_body['total'] ?? 0 );
            }
        }
    }

    update_option( 'ventatalk_last_sync_at', current_time( 'c' ) );

    wp_send_json_success( [
        'message' => sprintf(
            'Sincronización exitosa: %d productos nuevos, %d actualizados, %d órdenes y %d cupones sincronizados.',
            $products_created,
            $products_updated,
            $orders_synced,
            $coupons_synced
        ),
        'total' => intval( $body['total'] ?? 0 ),
    ] );
}

// ── Admin: CSS encolado solo en páginas de VentaTalk ─────────────────────────

add_action( 'admin_enqueue_scripts', 'ventatalk_enqueue_admin_assets' );

function ventatalk_enqueue_admin_assets() {
    $screen = get_current_screen();
    if ( ! $screen || strpos( $screen->id, 'ventatalk' ) === false ) return;

    wp_enqueue_style(
        'ventatalk-admin',
        VENTATALK_URL . 'public/css/admin.css',
        [],
        VENTATALK_VERSION
    );
}

// ── Admin: menú top-level ─────────────────────────────────────────────────────

add_action( 'admin_menu', 'ventatalk_admin_menu' );

// Permite que shop managers (manage_woocommerce sin manage_options) guarden settings
add_filter( 'option_page_capability_ventatalk_group', function() {
    return 'manage_woocommerce';
} );

function ventatalk_admin_menu() {
    $svg  = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="black"><path d="M12 3C6.5 3 2 6.58 2 11a7.77 7.77 0 0 0 2.75 5.74L3 21l4.75-1.5A11.14 11.14 0 0 0 12 21c5.5 0 10-3.58 10-8s-4.5-10-10-10z"/></svg>';
    $icon = 'data:image/svg+xml;base64,' . base64_encode( $svg );

    add_menu_page(
        'VentaTalk',
        'VentaTalk',
        'manage_woocommerce',
        'ventatalk',
        'ventatalk_render_dashboard_page',
        $icon,
        58
    );

    // Mismo slug que el parent → renombra el ítem auto-generado
    add_submenu_page(
        'ventatalk',
        'Dashboard — VentaTalk',
        'Dashboard',
        'manage_woocommerce',
        'ventatalk',
        'ventatalk_render_dashboard_page'
    );

    add_submenu_page(
        'ventatalk',
        'Configuración — VentaTalk',
        'Configuración',
        'manage_woocommerce',
        'ventatalk-settings',
        'ventatalk_render_settings_page'
    );
}

// ── Admin: página principal (dashboard) ───────────────────────────────────────

function ventatalk_render_dashboard_page() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) return;

    $opts          = ventatalk_get_options();
    $has_token     = ! empty( $opts['api_token'] );
    $domain_status = $opts['domain_status'] ?? '';
    $domain_url    = $opts['domain_site_url'] ?? '';
    $business_name = ! empty( $opts['business_name'] ) ? $opts['business_name'] : get_bloginfo( 'name' );
    $last_sync     = get_option( 'ventatalk_last_sync_at', '' );
    $nonce         = wp_create_nonce( 'ventatalk_sync_nonce' );

    $product_count = 0;
    if ( class_exists( 'WooCommerce' ) ) {
        $product_count = count( wc_get_products( [ 'status' => 'publish', 'limit' => -1, 'return' => 'ids' ] ) );
    }

    if ( ! $has_token ) {
        $badge_class = 'vt-badge-warning';
        $badge_text  = 'Sin configurar';
    } elseif ( $domain_status === 'verified' ) {
        $badge_class = 'vt-badge-success';
        $badge_text  = 'Conectado';
    } elseif ( in_array( $domain_status, [ 'error', 'error_token' ], true ) ) {
        $badge_class = 'vt-badge-error';
        $badge_text  = 'Error de configuración';
    } else {
        $badge_class = 'vt-badge-neutral';
        $badge_text  = 'Token configurado';
    }

    if ( $last_sync ) {
        $ts                = strtotime( $last_sync );
        $last_sync_display = $ts ? human_time_diff( $ts, current_time( 'timestamp' ) ) . ' atrás' : '—';
    } else {
        $last_sync_display = 'Nunca';
    }
    ?>
    <div class="vt-admin-wrap">

        <div class="vt-header">
            <div class="vt-header-logo">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="22" height="22"><path d="M12 3C6.5 3 2 6.58 2 11a7.77 7.77 0 0 0 2.75 5.74L3 21l4.75-1.5A11.14 11.14 0 0 0 12 21c5.5 0 10-3.58 10-8s-4.5-10-10-10z"/></svg>
                <strong>VentaTalk</strong>
            </div>
            <span class="vt-badge <?php echo esc_attr( $badge_class ); ?>"><?php echo esc_html( $badge_text ); ?></span>
        </div>

        <div class="vt-dashboard-grid">

            <div class="vt-col-main">

                <?php if ( ! $has_token ) : ?>
                <div class="vt-card vt-card-setup">
                    <h2 class="vt-card-title">Configura tu integración</h2>
                    <p class="vt-card-desc">Para sincronizar tu catálogo WooCommerce con VentaTalk necesitas un token de API. Encuéntralo en VentaTalk Dashboard → Integraciones → WordPress.</p>
                    <a href="<?php echo esc_url( admin_url( 'admin.php?page=ventatalk-settings' ) ); ?>" class="vt-btn vt-btn-primary">Ir a Configuración →</a>
                </div>
                <?php else : ?>

                <div class="vt-card">
                    <div class="vt-business-header">
                        <div class="vt-business-name"><?php echo esc_html( $business_name ); ?></div>
                        <?php if ( $domain_status === 'verified' && $domain_url ) : ?>
                        <div class="vt-domain-tag">
                            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="8" cy="8" r="7" fill="#16a34a"/><path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            <?php echo esc_html( preg_replace( '#^https?://#', '', rtrim( $domain_url, '/' ) ) ); ?>
                        </div>
                        <?php endif; ?>
                    </div>

                    <div class="vt-stats-row">
                        <div class="vt-stat-card">
                            <div class="vt-stat-number"><?php echo esc_html( number_format( $product_count ) ); ?></div>
                            <div class="vt-stat-label">Productos en tienda</div>
                        </div>
                        <div class="vt-stat-card">
                            <div class="vt-stat-number"><?php echo esc_html( $last_sync_display ); ?></div>
                            <div class="vt-stat-label">Última sincronización</div>
                        </div>
                    </div>

                    <div id="vt-sync-result" class="vt-sync-result" style="display:none;"></div>

                    <button
                        id="vt-sync-btn"
                        class="vt-btn vt-btn-primary vt-btn-sync"
                        data-nonce="<?php echo esc_attr( $nonce ); ?>"
                        data-ajax="<?php echo esc_attr( admin_url( 'admin-ajax.php' ) ); ?>"
                    >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10a8 8 0 0 0-14.93-2M4 14a8 8 0 0 0 14.93 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Sincronizar catálogo ahora
                    </button>

                    <p class="vt-sync-note">La sincronización en tiempo real ya está activa. Este botón ejecuta una sincronización completa manual.</p>
                </div>

                <?php endif; ?>

                <?php if ( ! empty( $opts['phone'] ) ) : ?>
                <div class="vt-card vt-card-shortcode">
                    <div class="vt-shortcode-label">Shortcode del widget</div>
                    <code class="vt-shortcode-code">[ventatalk_chat]</code>
                    <div class="vt-shortcode-desc">Sin shortcode, el botón flotante aparece automáticamente en todas las páginas.</div>
                </div>
                <?php endif; ?>

            </div><!-- .vt-col-main -->

            <div class="vt-col-side">
                <div class="vt-card vt-card-how">
                    <h3 class="vt-how-title">Cómo funciona</h3>
                    <div class="vt-steps">
                        <div class="vt-step">
                            <div class="vt-step-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M8 8h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            </div>
                            <div class="vt-step-body">
                                <div class="vt-step-title">Genera tu token</div>
                                <div class="vt-step-desc">En VentaTalk Dashboard → Integraciones → WordPress. Pégalo en <a href="<?php echo esc_url( admin_url( 'admin.php?page=ventatalk-settings' ) ); ?>">Configuración</a>.</div>
                            </div>
                        </div>
                        <div class="vt-step">
                            <div class="vt-step-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10a8 8 0 0 0-14.93-2M4 14a8 8 0 0 0 14.93 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </div>
                            <div class="vt-step-body">
                                <div class="vt-step-title">Sincronización automática</div>
                                <div class="vt-step-desc">Productos, órdenes y cupones se sincronizan al instante cuando los actualizas en WooCommerce.</div>
                            </div>
                        </div>
                        <div class="vt-step">
                            <div class="vt-step-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M12 3C6.5 3 2 6.58 2 11a7.77 7.77 0 0 0 2.75 5.74L3 21l4.75-1.5A11.14 11.14 0 0 0 12 21c5.5 0 10-3.58 10-8s-4.5-10-10-10z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            </div>
                            <div class="vt-step-body">
                                <div class="vt-step-title">Tu agente IA responde</div>
                                <div class="vt-step-desc">VentaTalk conoce tu catálogo completo y responde consultas por WhatsApp en tiempo real.</div>
                            </div>
                        </div>
                    </div>
                    <a href="https://ventatalk.com" target="_blank" class="vt-btn vt-btn-outline">Abrir VentaTalk Dashboard →</a>
                </div>
            </div><!-- .vt-col-side -->

        </div><!-- .vt-dashboard-grid -->
    </div><!-- .vt-admin-wrap -->

    <?php if ( $has_token ) : ?>
    <script>
    (function () {
        var btn    = document.getElementById('vt-sync-btn');
        var result = document.getElementById('vt-sync-result');
        if ( ! btn ) return;

        btn.addEventListener('click', function () {
            btn.disabled = true;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="animation:vt-spin 1s linear infinite"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10a8 8 0 0 0-14.93-2M4 14a8 8 0 0 0 14.93 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Sincronizando...';
            result.style.display = 'none';
            result.className     = 'vt-sync-result';

            var form = new FormData();
            form.append( 'action', 'ventatalk_sync_catalog' );
            form.append( 'nonce',  btn.dataset.nonce );

            fetch( btn.dataset.ajax, { method: 'POST', body: form } )
                .then( function( r ) { return r.json(); } )
                .then( function( data ) {
                    result.style.display = 'block';
                    if ( data.success ) {
                        result.classList.add( 'vt-sync-ok' );
                        result.textContent = '✓ ' + data.data.message;
                    } else {
                        result.classList.add( 'vt-sync-err' );
                        result.textContent = '✗ ' + data.data.message;
                    }
                } )
                .catch( function() {
                    result.style.display = 'block';
                    result.classList.add( 'vt-sync-err' );
                    result.textContent = '✗ Error de red. Verifica tu conexión e intenta de nuevo.';
                } )
                .finally( function() {
                    btn.disabled = false;
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 10a8 8 0 0 0-14.93-2M4 14a8 8 0 0 0 14.93 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Sincronizar catálogo ahora';
                } );
        } );
    } )();
    </script>
    <?php endif; ?>
    <?php
}

// ── Admin: página de configuración ────────────────────────────────────────────

function ventatalk_render_settings_page() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) return;
    $opts          = ventatalk_get_options();
    $phone         = preg_replace( '/[^0-9]/', '', $opts['phone'] );
    $domain_status = $opts['domain_status'] ?? '';
    $domain_url    = $opts['domain_site_url'] ?? '';
    ?>
    <div class="vt-admin-wrap">

        <div class="vt-header">
            <div class="vt-header-logo">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="22" height="22"><path d="M12 3C6.5 3 2 6.58 2 11a7.77 7.77 0 0 0 2.75 5.74L3 21l4.75-1.5A11.14 11.14 0 0 0 12 21c5.5 0 10-3.58 10-8s-4.5-10-10-10z"/></svg>
                <strong>VentaTalk</strong>
                <span class="vt-header-subtitle">/ Configuración</span>
            </div>
        </div>

        <?php if ( ! empty( $phone ) ) : ?>
        <div class="vt-notice vt-notice-success">
            <strong>Widget activo.</strong> Tus visitantes pueden iniciar conversaciones en WhatsApp.
            <a href="https://wa.me/<?php echo esc_attr( $phone ); ?>" target="_blank">Probar enlace →</a>
        </div>
        <?php else : ?>
        <div class="vt-notice vt-notice-warning">
            <strong>Ingresa un número de WhatsApp</strong> para activar el widget.
        </div>
        <?php endif; ?>

        <?php settings_errors( 'ventatalk_options' ); ?>

        <div class="vt-card vt-settings-card">
            <form method="post" action="options.php">
                <?php
                settings_fields( 'ventatalk_group' );
                do_settings_sections( 'ventatalk' );
                submit_button( 'Guardar cambios' );
                ?>
            </form>

            <?php if ( ! empty( $opts['api_token'] ) ) : ?>
            <div class="vt-domain-status-block">
                <?php if ( $domain_status === 'verified' && $domain_url ) : ?>
                    <div class="vt-domain-ok">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="8" cy="8" r="7" fill="#16a34a"/><path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Dominio verificado: <strong><?php echo esc_html( $domain_url ); ?></strong>
                    </div>
                <?php elseif ( $domain_status === 'error_token' ) : ?>
                    <div class="vt-domain-err">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="8" cy="8" r="7" fill="#dc2626"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
                        Token inválido — genera uno nuevo en VentaTalk Dashboard.
                    </div>
                <?php elseif ( $domain_status === 'error' ) : ?>
                    <div class="vt-domain-err">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><circle cx="8" cy="8" r="7" fill="#dc2626"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
                        Este token pertenece a otro sitio — contacta a soporte VentaTalk.
                    </div>
                <?php else : ?>
                    <div class="vt-domain-pending">
                        Token configurado. Guarda de nuevo si deseas verificar el dominio.
                    </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </div>

    </div><!-- .vt-admin-wrap -->
    <?php
}
