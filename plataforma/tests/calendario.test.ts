import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  columnas, desfaseMin, desplazar, diaEn, diasDeVista, duracionTexto, esDia, esHora, etiquetaGmt, horaEn, inicioSemana,
  instante, minutosDelDia, sumarDias, sumarMeses, tituloRango,
} from '../lib/calendario/tiempo.ts';

const M = 'Europe/Madrid';

test('instante convierte hora de pared a UTC, también con cambio de hora', () => {
  assert.equal(instante('2026-10-29', '09:00', M).toISOString(), '2026-10-29T08:00:00.000Z'); // invierno (+1)
  assert.equal(instante('2026-07-01', '09:00', M).toISOString(), '2026-07-01T07:00:00.000Z'); // verano (+2)
  assert.equal(instante('2026-10-25', '12:00', M).toISOString(), '2026-10-25T11:00:00.000Z'); // día del cambio
  assert.equal(instante('2026-03-29', '12:00', M).toISOString(), '2026-03-29T10:00:00.000Z');
  assert.equal(instante('2026-10-29', '09:00', 'America/New_York').toISOString(), '2026-10-29T13:00:00.000Z');
});

test('ida y vuelta: día, hora y minutos en la zona', () => {
  const t = instante('2026-12-31', '23:45', M);
  assert.equal(diaEn(t, M), '2026-12-31');
  assert.equal(horaEn(t, M), '23:45');
  assert.equal(minutosDelDia(t, M), 23 * 60 + 45);
  assert.equal(diaEn(t, 'UTC'), '2026-12-31');
  assert.equal(horaEn(instante('2026-01-01', '00:30', M), M), '00:30');
});

test('desfase y etiqueta GMT', () => {
  assert.equal(desfaseMin(new Date('2026-01-15T12:00:00Z'), M), 60);
  assert.equal(desfaseMin(new Date('2026-07-15T12:00:00Z'), M), 120);
  assert.equal(etiquetaGmt(new Date('2026-01-15T12:00:00Z'), M), 'GMT +01:00');
  assert.equal(etiquetaGmt(new Date('2026-01-15T12:00:00Z'), 'America/Caracas'), 'GMT -04:00');
  assert.equal(etiquetaGmt(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata'), 'GMT +05:30');
});

test('aritmética de días', () => {
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumarDias('2024-03-01', -1), '2024-02-29');
  assert.equal(sumarMeses('2026-01-31', 1), '2026-02-01');
  assert.equal(sumarMeses('2026-01-15', -1), '2025-12-01');
  assert.equal(inicioSemana('2026-10-29'), '2026-10-25'); // jueves → domingo
  assert.equal(inicioSemana('2026-10-25'), '2026-10-25');
  assert.equal(desplazar('semana', '2026-10-29', 1), '2026-11-05');
  assert.equal(desplazar('mes', '2026-10-29', -1), '2026-09-01');
});

test('días de cada vista', () => {
  assert.deepEqual(diasDeVista('dia', '2026-10-29'), ['2026-10-29']);
  const s = diasDeVista('semana', '2026-10-29');
  assert.equal(s.length, 7);
  assert.equal(s[0], '2026-10-25');
  assert.equal(s[6], '2026-10-31');
  const m = diasDeVista('mes', '2026-10-29');
  assert.equal(m.length, 42);
  assert.equal(m[0], '2026-09-27');
});

test('títulos del rango como el original', () => {
  assert.equal(tituloRango('semana', '2026-10-29'), '25 – 31 oct 2026');
  assert.equal(tituloRango('semana', '2026-10-01'), '27 sept – 3 oct 2026');
  assert.equal(tituloRango('semana', '2026-12-30'), '27 dic 2026 – 2 ene 2027');
  assert.equal(tituloRango('mes', '2026-10-29'), 'octubre de 2026');
  assert.equal(tituloRango('dia', '2026-10-29'), '29 oct 2026');
});

test('validadores', () => {
  assert.ok(esDia('2026-02-28'));
  assert.ok(!esDia('2026-02-30'));
  assert.ok(!esDia('29/10/2026'));
  assert.ok(esHora('09:30'));
  assert.ok(!esHora('24:00'));
  assert.ok(!esHora('9:30'));
  assert.equal(duracionTexto(30), '30 min');
  assert.equal(duracionTexto(90), '1 h 30 min');
  assert.equal(duracionTexto(120), '2 h');
});

test('columnas para eventos que se solapan', () => {
  const r = columnas([
    { id: 'a', ini: 0, fin: 60 },
    { id: 'b', ini: 30, fin: 90 },
    { id: 'c', ini: 60, fin: 120 },
    { id: 'd', ini: 200, fin: 230 },
  ]);
  const por = Object.fromEntries(r.map((e) => [e.id, `${e.col}/${e.cols}`]));
  assert.equal(por.a, '0/2');
  assert.equal(por.b, '1/2');
  assert.equal(por.c, '0/2'); // reutiliza la columna de «a», que ya terminó
  assert.equal(por.d, '0/1');
});
