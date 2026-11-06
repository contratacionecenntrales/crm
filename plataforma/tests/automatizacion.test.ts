import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlPublica, esperaEnMinutos, esquemaPasos, pasoVacio, rellenarVariables, resumenPaso } from '../lib/automatizacion/tipos.ts';

test('variables de las plantillas', () => {
  const v = { 'contacto.nombre': 'Luis', 'empresa.nombre': 'Clínica Norte' };
  assert.equal(rellenarVariables('Hola {{contacto.nombre}}, soy de {{ empresa.nombre }}.', v), 'Hola Luis, soy de Clínica Norte.');
  assert.equal(rellenarVariables('{{cita.fecha}}|{{Contacto.Nombre}}', v), '|Luis');
});

test('validación de pasos', () => {
  assert.ok(esquemaPasos.safeParse([pasoVacio('enviar_sms'), pasoVacio('esperar'), { tipo: 'anadir_etiqueta', etiqueta: 'vip' }]).success);
  assert.ok(!esquemaPasos.safeParse([{ tipo: 'anadir_etiqueta', etiqueta: '' }]).success);
  assert.ok(!esquemaPasos.safeParse([{ tipo: 'webhook', url: 'http://inseguro.com' }]).success);
  assert.ok(!esquemaPasos.safeParse([{ tipo: 'condicion', regla: 'tiene_etiqueta', etiqueta: '' }]).success);
  assert.ok(!esquemaPasos.safeParse([{ tipo: 'borrar_todo' }]).success);
});

test('esperas y resúmenes', () => {
  assert.equal(esperaEnMinutos({ cantidad: 2, unidad: 'dias' }), 2880);
  assert.equal(esperaEnMinutos({ cantidad: 3, unidad: 'horas' }), 180);
  assert.equal(resumenPaso({ tipo: 'esperar', cantidad: 1, unidad: 'dias' }), '1 día');
  assert.equal(resumenPaso({ tipo: 'condicion', regla: 'tiene_etiqueta', etiqueta: 'vip' }), 'Si tiene «vip»; si no, termina');
});

test('webhooks: solo direcciones públicas por https', () => {
  assert.ok(urlPublica('https://hooks.zapier.com/x'));
  for (const u of ['http://ejemplo.com', 'https://localhost/x', 'https://127.0.0.1/', 'https://10.0.0.5/', 'https://192.168.1.1', 'https://172.20.0.1',
    'https://169.254.169.254/latest', 'https://[::1]/', 'https://db.internal/', 'nada', 'https://[::ffff:127.0.0.1]/', 'https://[::ffff:a9fe:a9fe]/',
    'https://[::127.0.0.1]/', 'https://[64:ff9b::7f00:1]/', 'https://localhost./', 'https://metadata.google.internal./', 'https://198.18.0.1/',
    'https://usuario:clave@ejemplo.com/']) assert.ok(!urlPublica(u), u);
  for (const u of ['https://fcbarcelona.com/', 'https://fdroid.org/', 'https://[2606:4700::1111]/']) assert.ok(urlPublica(u), u);
});

test('las campañas automáticas preconstruidas son flujos válidos', async () => {
  const { RECETAS, PLANTILLAS_ENVIO } = await import('../lib/marketing/plantillas.ts');
  const { esquemaPasos, DISPARADORES } = await import('../lib/automatizacion/tipos.ts');
  for (const r of RECETAS) {
    const v = esquemaPasos.safeParse(r.pasos);
    assert.ok(v.success, `${r.id}: ${v.success ? '' : JSON.stringify(v.error.issues[0])}`);
    assert.ok(DISPARADORES.some((d) => d.valor === r.disparador), `${r.id}: disparador`);
  }
  for (const p of PLANTILLAS_ENVIO) {
    assert.ok(p.cuerpo.length > 20 && (p.canal !== 'email' || p.asunto), `${p.id}`);
    if (p.canal === 'sms') assert.ok(p.cuerpo.length <= 400, `${p.id}: SMS demasiado largo`);
  }
});

test('las ramas se compilan a saltos y se evalúan bien', async () => {
  const { compilar, evaluar, rellenar } = await import('../lib/automatizacion/programa.ts');
  const prog = compilar([
    { tipo: 'nota', texto: 'antes' },
    { tipo: 'si', modo: 'todas', reglas: [{ campo: 'contacto.etiquetas', operador: 'contiene', valor: 'vip' }], si: [{ tipo: 'nota', texto: 'vip' }], no: [{ tipo: 'nota', texto: 'normal' }, { tipo: 'nota', texto: 'normal2' }] },
    { tipo: 'nota', texto: 'despues' },
  ]);
  // Recorre el programa como el motor y devuelve las notas que se ejecutarían.
  const correr = (etiquetas: string[]) => {
    const notas: string[] = []; let i = 0;
    while (i < prog.length) {
      const x = prog[i];
      if (x.tipo === '_ir') { i = x.a; continue; }
      if (x.tipo === '_si') { i = evaluar(x.reglas, x.modo, () => etiquetas) ? i + 1 : x.saltar; continue; }
      if (x.tipo === 'nota') notas.push(x.texto);
      i++;
    }
    return notas.join(',');
  };
  assert.equal(correr(['vip']), 'antes,vip,despues');
  assert.equal(correr(['otro']), 'antes,normal,normal2,despues');
  assert.equal(evaluar([{ campo: 'x', operador: 'mayor', valor: '10,5' }], 'todas', () => '11'), true);
  assert.equal(evaluar([{ campo: 'x', operador: 'vacio', valor: '' }, { campo: 'y', operador: 'igual', valor: 'A' }], 'alguna', (c) => (c === 'y' ? 'a' : 'algo')), true);
  assert.equal(rellenar('{"n":"{{var.r.datos.nombre}}"}', () => 'Ana "la" Pérez', 'json'), '{"n":"Ana \\"la\\" Pérez"}');
  assert.equal(rellenar('https://x.com/?q={{webhook.q}}', () => 'a b&c', 'url'), 'https://x.com/?q=a%20b%26c');
});

test('el árbol de pasos se edita por rutas', async () => {
  const a = await import('../lib/automatizacion/arbol.ts');
  let p = [{ tipo: 'nota', texto: 'a' }, { tipo: 'si', modo: 'todas', reglas: [{ campo: 'x', operador: 'vacio', valor: '' }], si: [], no: [] }] as never[];
  p = a.insertar(p, '1.si', 0, { tipo: 'nota', texto: 'dentro' } as never) as never[];
  p = a.insertar(p, '1.si', 1, { tipo: 'nota', texto: 'dentro2' } as never) as never[];
  assert.equal((a.obtener(p, '1.si.1') as { texto: string }).texto, 'dentro2');
  const m = a.mover(p, '1.si.1', -1);
  assert.equal(m.nodo, '1.si.0');
  assert.equal((a.obtener(m.pasos, '1.si.0') as { texto: string }).texto, 'dentro2');
  const q = a.quitar(m.pasos, '1.si.0');
  assert.equal(a.listaEn(q, '1.si')!.length, 1);
  assert.equal((a.obtener(p, '0') as { texto: string }).texto, 'a'); // el original no cambia
});
