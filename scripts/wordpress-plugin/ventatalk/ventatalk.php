<?php
/**
 * Plugin Name:  VentaTalk Chat Widget
 * Plugin URI:   https://ventatalk.com
 * Description:  Agrega un botón flotante de WhatsApp a tu sitio. Los visitantes pueden iniciar una conversación con tu agente IA directamente desde la web.
 * Version:      1.1.0
 * Author:       VentaTalk
 * Author URI:   https://ventatalk.com
 * License:      GPL v2 or later
 * Text Domain:  ventatalk
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'VENTATALK_VERSION', '1.1.0' );
define( 'VENTATALK_URL',     plugin_dir_url( __FILE__ ) );
define( 'VENTATALK_PATH',    plugin_dir_path( __FILE__ ) );

// ── Includes ──────────────────────────────────────────────────────────────────

require_once VENTATALK_PATH . 'includes/settings.php';

// ── Enqueue assets en el frontend ─────────────────────────────────────────────

add_action( 'wp_enqueue_scripts', 'ventatalk_enqueue_assets' );

function ventatalk_enqueue_assets() {
    $opts = ventatalk_get_options();

    // No cargar si el widget está desactivado
    if ( empty( $opts['phone'] ) ) return;

    wp_enqueue_style(
        'ventatalk-widget',
        VENTATALK_URL . 'public/css/widget.css',
        [],
        VENTATALK_VERSION
    );

    wp_enqueue_script(
        'ventatalk-widget',
        VENTATALK_URL . 'public/js/widget.js',
        [],
        VENTATALK_VERSION,
        true   // en el footer
    );

    // Pasar configuración al JS
    wp_localize_script( 'ventatalk-widget', 'VentaTalkConfig', [
        'phone'        => preg_replace( '/[^0-9]/', '', $opts['phone'] ),
        'businessName' => esc_js( $opts['business_name'] ),
        'greeting'     => esc_js( $opts['greeting'] ),
        'message'      => esc_js( $opts['message'] ),
        'color'        => esc_js( $opts['color'] ),
        'position'     => esc_js( $opts['position'] ),
        'delay'        => intval( $opts['delay'] ),
    ] );
}

// ── Shortcode [ventatalk_chat] ────────────────────────────────────────────────

add_shortcode( 'ventatalk_chat', 'ventatalk_shortcode' );

function ventatalk_shortcode( $atts ) {
    // El shortcode solo inserta el contenedor; el JS lo inicializa igual
    return '<div id="ventatalk-anchor"></div>';
}

// ── Activación / desactivación ────────────────────────────────────────────────

register_activation_hook( __FILE__, 'ventatalk_activate' );

function ventatalk_activate() {
    add_option( 'ventatalk_options', ventatalk_default_options() );
}

register_deactivation_hook( __FILE__, 'ventatalk_deactivate' );

function ventatalk_deactivate() {
    // No eliminar opciones — el usuario puede reactivar sin perder config
}
