/* VentaTalk Chat Widget v1.1.0 */
(function () {
  'use strict';

  var cfg = window.VentaTalkConfig || {};

  // Validación mínima
  if (!cfg.phone) return;

  // ── SVG icons ────────────────────────────────────────────────────────────────

  var SVG_WA =
    '<svg class="vb-icon-wa" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
    '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-' +
    '1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.3' +
    '47.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.6' +
    '12-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074' +
    '-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 ' +
    '2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-' +
    '.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.' +
    '347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-' +
    '.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122' +
    ' 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m' +
    '8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4' +
    '.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 1' +
    '1.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';

  var SVG_CLOSE =
    '<svg class="vb-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  var SVG_WA_CTA =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15' +
    '-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-' +
    '1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.3' +
    '47.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.6' +
    '12-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074' +
    '-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 ' +
    '2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-' +
    '.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.' +
    '347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-' +
    '.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122' +
    ' 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m' +
    '8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4' +
    '.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 1' +
    '1.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';

  // ── Construir HTML ────────────────────────────────────────────────────────────

  function buildWidget() {
    var color    = cfg.color || '#16a34a';
    var name     = cfg.businessName || 'Atención al cliente';
    var greeting = cfg.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?';
    var phone    = cfg.phone;
    var message  = cfg.message || 'Hola, vengo desde el sitio web.';
    var waUrl    = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);

    var root = document.createElement('div');
    root.id = 'ventatalk-root';
    root.className = 'pos-' + (cfg.position || 'right');

    root.innerHTML =
      // Popup
      '<div id="ventatalk-popup" role="dialog" aria-label="Iniciar chat">' +
        '<div class="vb-header">' +
          '<div class="vb-avatar" style="background:' + color + ';">' +
            SVG_WA +
          '</div>' +
          '<div class="vb-meta">' +
            '<div class="vb-business-name">' + escapeHtml(name) + '</div>' +
            '<div class="vb-status">' +
              '<span class="vb-status-dot"></span>' +
              '<span class="vb-status-text">En línea</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="vb-body">' +
          '<div class="vb-bubble">' + escapeHtml(greeting) + '</div>' +
        '</div>' +
        '<a href="' + waUrl + '" target="_blank" rel="noopener" class="vb-cta" style="background:' + color + ';">' +
          SVG_WA_CTA +
          'Iniciar conversación' +
        '</a>' +
        '<div class="vb-footer">' +
          '<a href="https://ventatalk.com" target="_blank" rel="noopener">Powered by VentaTalk</a>' +
        '</div>' +
      '</div>' +
      // Botón flotante
      '<button id="ventatalk-btn" style="background:' + color + ';" aria-label="Abrir chat WhatsApp">' +
        SVG_WA +
        SVG_CLOSE +
      '</button>';

    return root;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Estado ────────────────────────────────────────────────────────────────────

  var isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    var root = document.getElementById('ventatalk-root');
    if (isOpen) {
      root.classList.add('is-open');
    } else {
      root.classList.remove('is-open');
    }
  }

  // Cerrar con Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) toggle();
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    var root = document.getElementById('ventatalk-root');
    if (root && !root.contains(e.target)) toggle();
  });

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    var root   = buildWidget();
    var btn    = root.querySelector('#ventatalk-btn');
    var ctaBtn = root.querySelector('.vb-cta');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    // El CTA (link a WA) no cierra el popup — el navegador lo maneja
    ctaBtn.addEventListener('click', function () {
      // Pequeño delay para que el usuario vea el efecto antes de abrir WA
      setTimeout(function () {
        if (isOpen) toggle();
      }, 300);
    });

    document.body.appendChild(root);
  }

  // ── Arrancar con demora opcional ──────────────────────────────────────────────

  var delay = parseInt(cfg.delay, 10) || 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, delay * 1000);
    });
  } else {
    setTimeout(init, delay * 1000);
  }

})();
