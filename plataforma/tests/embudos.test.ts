import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLAS, PAGINA_EN_BLANCO } from '../lib/embudos/plantillas.ts';
import { esquemaContenido, enlaceSeguro, imagenSegura, videoInsertable, slugEmbudo, rutaPaso } from '../lib/embudos/tipos.ts';
import { textoSobre } from '../lib/embudos/color.ts';

test('todas las plantillas cumplen el esquema', () => {
  for (const p of PLANTILLAS) {
    const pasos = p.pasos();
    assert.ok(pasos.length >= 1, p.id);
    assert.equal(new Set(pasos.map((x) => x.ruta)).size, pasos.length, `${p.id}: rutas repetidas`);
    for (const paso of pasos) {
      const r = esquemaContenido.safeParse(paso.contenido);
      assert.ok(r.success, `${p.id}/${paso.ruta}: ${r.success ? '' : JSON.stringify(r.error.issues[0])}`);
    }
  }
  assert.ok(esquemaContenido.safeParse(PAGINA_EN_BLANCO()).success);
});

test('los enlaces peligrosos se descartan', () => {
  assert.equal(enlaceSeguro('javascript:alert(1)'), null);
  assert.equal(enlaceSeguro(' JaVaScRiPt:alert(1)'), null);
  assert.equal(enlaceSeguro('data:text/html,<script>'), null);
  assert.equal(enlaceSeguro('vbscript:x'), null);
  assert.equal(enlaceSeguro('https://ejemplo.com/a?b=1'), 'https://ejemplo.com/a?b=1');
  assert.equal(enlaceSeguro('mailto:hola@ejemplo.com'), 'mailto:hola@ejemplo.com');
  assert.equal(enlaceSeguro('#precios'), '#precios');
  assert.equal(imagenSegura('mailto:x@y.z'), null);
});

test('vídeos: solo YouTube y Vimeo', () => {
  assert.equal(videoInsertable('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(videoInsertable('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(videoInsertable('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  assert.equal(videoInsertable('https://malo.com/embed/dQw4w9WgXcQ'), null);
});

test('un formulario sin correo ni teléfono no se acepta', () => {
  const c = PAGINA_EN_BLANCO();
  c.secciones[0].bloques.push({ id: 'f1', tipo: 'formulario', campos: [{ clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }], boton: 'Ir', etiquetas: [], despues: 'mensaje', url: '', mensaje: '', aviso_legal: '' });
  assert.equal(esquemaContenido.safeParse(c).success, false);
});

test('slugs y contraste', () => {
  assert.equal(slugEmbudo('Captación de Clientes!', 'x7k2'), 'captacion-de-clientes-x7k2');
  assert.equal(rutaPaso('Página de gracias'), 'pagina-de-gracias');
  assert.equal(textoSobre('#ffffff'), '#101828');
  assert.equal(textoSobre('#0b1f4d'), '#ffffff');
});

test('todas las plantillas de sitio cumplen el esquema y enlazan a páginas que existen', async () => {
  const { PLANTILLAS_SITIO } = await import('../lib/embudos/sitios.ts');
  for (const p of PLANTILLAS_SITIO) {
    const paginas = p.paginas();
    const rutas = new Set(paginas.map((x) => x.ruta));
    assert.equal(rutas.size, paginas.length, `${p.id}: rutas repetidas`);
    if (p.config.menu_cta_ruta) assert.ok(rutas.has(p.config.menu_cta_ruta), `${p.id}: el botón del menú lleva a una página que no existe`);
    for (const x of paginas) {
      const v = esquemaContenido.safeParse(x.contenido);
      assert.ok(v.success, `${p.id}/${x.ruta}: ${v.success ? '' : JSON.stringify(v.error.issues[0])}`);
      // Todo botón «Ir a otra página» apunta a una ruta del sitio.
      for (const m of JSON.stringify(x.contenido).matchAll(/"(?:boton_|boton2_)?accion":"pagina","(?:boton_|boton2_)?url":"([^"]*)"/g)) assert.ok(rutas.has(m[1]), `${p.id}/${x.ruta}: enlace a «${m[1]}»`);
    }
  }
});
