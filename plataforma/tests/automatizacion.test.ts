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
