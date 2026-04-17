<?php
/**
 * Plugin Name:  VentaTalk Chat Widget
 * Plugin URI:   https://ventatalk.com
 * Description:  Agrega un botón flotante de WhatsApp a tu sitio. Los visitantes pueden iniciar una conversación con tu agente IA directamente desde la web.
 * Version:      1.0.0
 * Author:       VentaTalk
 * Author URI:   https://ventatalk.com
 * License:      GPL v2 or later
 * Text Domain:  ventabot
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'VENTABOT_VERSION', '1.0.0' );
define( 'VENTABOT_URL',     plugin_dir_url( __FILE__ ) );
define( 'VENTABOT_PATH',    plugin_dir_path( __FILE__ ) );

// ── Includes ──────────────────────────────────────────────────────────────────

require_once VENTABOT_PATH . 'includes/settings.php';

// ── Enqueue assets en el frontend ─────────────────────────────────────────────

add_action( 'wp_enqueue_scripts', 'ventabot_enqueue_assets' );

function ventabot_enqueue_assets() {
    $opts = ventabot_get_options();

    // No cargar si el widget está desactivado
    if ( empty( $opts['phone'] ) ) return;

    wp_enqueue_style(
        'ventabot-widget',
        VENTABOT_URL . 'public/css/widget.css',
        [],
        VENTABOT_VERSION
    );

    wp_enqueue_script(
        'ventabot-widget',
        VENTABOT_URL . 'public/js/widget.js',
        [],
        VENTABOT_VERSION,
        true   // en el footer
    );

    // Pasar configuración al JS
    wp_localize_script( 'ventabot-widget', 'VentabotConfig', [
        'phone'        => preg_replace( '/[^0-9]/', '', $opts['phone'] ),
        'businessName' => esc_js( $opts['business_name'] ),
        'greeting'     => esc_js( $opts['greeting'] ),
        'message'      => esc_js( $opts['message'] ),
        'color'        => esc_js( $opts['color'] ),
        'position'     => esc_js( $opts['position'] ),
        'delay'        => intval( $opts['delay'] ),
    ] );
}

// ── Shortcode [ventabot_chat] ─────────────────────────────────────────────────

add_shortcode( 'ventabot_chat', 'ventabot_shortcode' );

function ventabot_shortcode( $atts ) {
    // El shortcode solo inserta el contenedor; el JS lo inicializa igual
    return '<div id="ventabot-anchor"></div>';
}

// ── Activación / desactivación ────────────────────────────────────────────────

register_activation_hook( __FILE__, 'ventabot_activate' );

function ventabot_activate() {
    add_option( 'ventabot_options', ventabot_default_options() );
}

register_deactivation_hook( __FILE__, 'ventabot_deactivate' );

function ventabot_deactivate() {
    // No eliminar opciones — el usuario puede reactivar sin perder config
}
