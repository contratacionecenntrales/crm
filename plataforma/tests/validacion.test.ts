import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esquemaPago, esquemaSubcuenta, esquemaSuscripcion } from '../lib/validacion.ts';
import { iniciales, direccionCompleta, haceCuanto } from '../lib/formato.ts';

const base = {
  nombre: 'LABS24K / GIJÓN', email: 'Info@Labs24k.com', prefijo: '+34', telefono: '632-22-86-08', direccion: 'Calle Marqués de San Esteban 2',
  ciudad: 'Gijón', provincia: 'Asturias', codigo_postal: '33206', pais: 'es', web: 'https://labs24k.com', zona_horaria: 'Europe/Madrid',
};

test('subcuenta válida se normaliza', () => {
  const r = esquemaSubcuenta.parse(base);
  assert.equal(r.email, 'info@labs24k.com');
  assert.equal(r.telefono, '632228608');
  assert.equal(r.pais, 'ES');
});

test('subcuenta: correo vacío pasa a null; web sin protocolo y zona inventada se rechazan', () => {
  assert.equal(esquemaSubcuenta.parse({ ...base, email: '' }).email, null);
  assert.equal(esquemaSubcuenta.safeParse({ ...base, web: 'labs24k.com' }).success, false);
  assert.equal(esquemaSubcuenta.safeParse({ ...base, zona_horaria: 'Marte/Olimpo' }).success, false);
  assert.equal(esquemaSubcuenta.safeParse({ ...base, nombre: 'A' }).success, false);
});

test('importes aceptan coma decimal y rechazan basura', () => {
  assert.equal(esquemaSuscripcion.parse({ plan: 'Pro', importe_mensual: '97,50', estado: 'activa', inicio: '2026-10-01' }).importe_mensual, 97.5);
  assert.equal(esquemaSuscripcion.safeParse({ plan: 'Pro', importe_mensual: '-1', estado: 'activa', inicio: '2026-10-01' }).success, false);
  assert.equal(esquemaPago.safeParse({ importe: 'abc', concepto: 'x', fecha: '2026-10-01' }).success, false);
  assert.equal(esquemaPago.safeParse({ importe: '0', concepto: 'x', fecha: '2026-10-01' }).success, false);
});

test('formato', () => {
  assert.equal(iniciales('LABS24K / GIJÓN'), 'LG');
  assert.equal(iniciales('contratacionecentrales@gmail.com'), 'CO');
  assert.equal(direccionCompleta({ direccion: 'Calle 2', ciudad: 'Gijón', provincia: '', codigo_postal: '33206' }), 'Calle 2, 33206 Gijón');
  assert.equal(haceCuanto(new Date('2026-10-29T10:00:00Z'), new Date('2026-10-29T10:09:00Z')), 'hace 9 minutos');
});
