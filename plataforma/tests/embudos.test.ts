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
