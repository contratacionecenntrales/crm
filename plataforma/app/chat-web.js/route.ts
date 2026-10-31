// Script que la subcuenta pega en su web:
//   <script src="https://TU-DOMINIO/chat-web.js" data-clave="…" async></script>
// Pinta el globo y abre la ventana del chat en un iframe (sus estilos no
// chocan con los de la web del cliente).
const SCRIPT = `(function () {
  var s = document.currentScript;
  if (!s || window.__chatWebMetatok) return;
  var clave = s.getAttribute('data-clave') || '';
  if (!/^[0-9a-f]{24}$/.test(clave)) return;
  window.__chatWebMetatok = true;
  var base = new URL(s.src).origin;
  var ICONO = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var CERRAR = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  fetch(base + '/api/chat/' + clave).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (c) montar(c);
  }).catch(function () {});

  function montar(c) {
    var color = /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#155eef';
    var lado = c.posicion === 'izquierda' ? 'left' : 'right';
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-label', String(c.titulo || 'Chat'));
    boton.setAttribute('aria-expanded', 'false');
    boton.innerHTML = ICONO;
    boton.style.cssText = 'position:fixed;bottom:20px;' + lado + ':20px;width:60px;height:60px;border-radius:50%;border:0;padding:0;' +
      'background:' + color + ';color:#fff;box-shadow:0 6px 20px rgba(16,24,40,.25);cursor:pointer;z-index:2147483646;' +
      'display:flex;align-items:center;justify-content:center;transition:transform .15s';
    var marco = null;
    var abierto = false;
    function colocar() {
      if (!marco) return;
      var movil = window.innerWidth < 480;
      marco.style.cssText = 'position:fixed;z-index:2147483647;border:0;background:#fff;color-scheme:light;box-shadow:0 12px 40px rgba(16,24,40,.25);' +
        (movil ? 'inset:0;width:100%;height:100%;border-radius:0;' :
          'bottom:92px;' + lado + ':20px;width:380px;height:min(620px,calc(100vh - 120px));border-radius:16px;') +
        'display:' + (abierto ? 'block' : 'none');
    }
    function alternar(v) {
      abierto = v;
      if (abierto && !marco) {
        marco = document.createElement('iframe');
        marco.src = base + '/chat/' + clave + '?origen=' + encodeURIComponent(location.hostname);
        marco.title = String(c.titulo || 'Chat');
        document.body.appendChild(marco);
      }
      colocar();
      boton.innerHTML = abierto ? CERRAR : ICONO;
      boton.setAttribute('aria-expanded', String(abierto));
    }
    boton.addEventListener('click', function () { alternar(!abierto); });
    window.addEventListener('resize', colocar);
    window.addEventListener('message', function (e) {
      if (e.origin === base && e.data === 'chat-web:cerrar') alternar(false);
    });
    document.body.appendChild(boton);
  }
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
