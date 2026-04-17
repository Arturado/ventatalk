=== VentaTalk Chat Widget ===
Contributors: ventatalk
Tags: whatsapp, chat, widget, floating button, ventatalk, chatbot, ia, ventas
Requires at least: 5.9
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Agrega un botón flotante de WhatsApp a tu sitio. Los visitantes pueden iniciar una conversación con tu agente IA directamente desde la web.

== Description ==

**VentaTalk Chat Widget** conecta tu sitio WordPress con tu agente de ventas IA de VentaTalk a través de WhatsApp.

Con un solo clic, tus visitantes abren WhatsApp con un mensaje pre-escrito listo para enviar — sin formularios, sin esperas, sin fricción.

= Características =

* Botón flotante de WhatsApp con animación de pulso
* Popup con nombre del negocio, estado en línea y mensaje de bienvenida
* Color, posición y mensaje 100% personalizables desde el panel de WordPress
* Demora de aparición configurable (ideal para no interrumpir al visitante)
* Compatible con shortcode `[ventabot_chat]` para posicionamiento manual
* Responsive: se adapta automáticamente a móviles
* Sin dependencias externas — carga rápida, sin jQuery
* Respeta `prefers-reduced-motion` para accesibilidad

= ¿Cómo funciona? =

1. El visitante hace clic en el botón de WhatsApp
2. Se abre WhatsApp con tu número y un mensaje pre-configurado
3. El mensaje puede incluir el prefijo `[WEB]` para identificar el origen en tu dashboard de VentaTalk
4. Tu agente IA responde automáticamente y califica al lead

= Requisitos =

* Cuenta activa en [VentaTalk](https://ventatalk.com)
* Número de WhatsApp Business registrado

== Installation ==

= Instalación manual (recomendada para pilotos) =

1. Descarga el archivo `ventabot.zip`
2. En tu panel de WordPress, ve a **Plugins → Añadir nuevo → Subir plugin**
3. Selecciona el archivo `ventabot.zip` y haz clic en **Instalar ahora**
4. Activa el plugin
5. Ve a **Ajustes → VentaTalk** y configura tu número de WhatsApp

= Instalación vía FTP =

1. Descomprime `ventabot.zip`
2. Sube la carpeta `ventabot/` a `/wp-content/plugins/`
3. Activa el plugin desde **Plugins → Plugins instalados**
4. Configura en **Ajustes → VentaTalk**

== Configuration ==

Tras activar el plugin, ve a **Ajustes → VentaTalk**:

* **Número WhatsApp** — Tu número con código de país. Ej: `+56912345678`. Sin este campo el widget no aparece.
* **Nombre del negocio** — Se muestra en el popup. Por defecto usa el nombre de tu sitio.
* **Mensaje de bienvenida** — Texto que aparece en el popup antes de abrir WhatsApp.
* **Mensaje pre-escrito** — Texto que se envía automáticamente al abrir WhatsApp. Usa `[WEB]` como prefijo para identificar el origen en VentaTalk.
* **Color del botón** — Color principal del widget (hex). Por defecto verde WhatsApp `#16a34a`.
* **Posición** — Derecha o Izquierda de la pantalla.
* **Demora de aparición** — Segundos antes de que aparezca el widget (0 = inmediato).

== Frequently Asked Questions ==

= ¿Necesito una cuenta de VentaTalk para usar este plugin? =

Para el botón flotante básico de WhatsApp, no es obligatorio. Cualquier número de WhatsApp funciona. Sin embargo, para acceder al agente IA, el CRM y el dashboard de conversaciones, necesitas una cuenta en VentaTalk.

= ¿El widget aparece en todas las páginas? =

Sí, por defecto aparece en todas las páginas del frontend. Si prefieres colocarlo manualmente en una página específica, puedes desactivar la aparición automática y usar el shortcode `[ventabot_chat]`.

= ¿Puedo cambiar el color del botón? =

Sí, desde **Ajustes → VentaTalk** puedes seleccionar cualquier color con el selector de color integrado.

= ¿Funciona en móviles? =

Sí. El widget es responsive y se adapta automáticamente. En móviles, abre la app de WhatsApp instalada en el dispositivo.

= ¿El plugin ralentiza mi sitio? =

No. El widget carga en el footer con un archivo CSS (~4KB) y JS (~4KB) minúsculos, sin dependencias externas.

= ¿Cómo identifico en VentaTalk que el lead viene desde la web? =

Configura el **Mensaje pre-escrito** con el prefijo `[WEB]`. Por ejemplo: `[WEB] Hola, vengo desde el sitio web y quiero consultar.` VentaTalk filtra automáticamente las conversaciones por este prefijo.

== Screenshots ==

1. Botón flotante de WhatsApp en la esquina inferior derecha
2. Popup expandido con nombre del negocio y CTA
3. Panel de configuración en WordPress Admin → Ajustes → VentaTalk

== Changelog ==

= 1.0.0 =
* Versión inicial
* Botón flotante con animación de pulso
* Popup con header, burbuja de mensaje y CTA
* Panel de configuración completo en WordPress Admin
* Soporte para shortcode `[ventabot_chat]`
* Responsive y accesible (prefers-reduced-motion)

== Upgrade Notice ==

= 1.0.0 =
Primera versión estable.
