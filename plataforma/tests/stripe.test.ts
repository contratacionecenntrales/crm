import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { estadoDesdeStripe, importeMensualDesdeItems, verificarFirmaStripe } from '../lib/stripe.ts';

const secreto = 'whsec_prueba';
const cuerpo = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
const firmar = (t: number, c = cuerpo, s = secreto) => createHmac('sha256', s).update(`${t}.${c}`).digest('hex');

test('acepta una firma válida', () => {
  const t = 1_800_000_000;
  assert.equal(verificarFirmaStripe(cuerpo, `t=${t},v1=${firmar(t)}`, secreto, 300, t + 10), true);
});

test('acepta si una de varias v1 es válida (rotación de secreto)', () => {
  const t = 1_800_000_000;
  assert.equal(verificarFirmaStripe(cuerpo, `t=${t},v1=${firmar(t, cuerpo, 'viejo')},v1=${firmar(t)}`, secreto, 300, t), true);
});

test('rechaza cuerpo alterado, secreto erróneo, firma caducada o cabecera vacía', () => {
  const t = 1_800_000_000;
  assert.equal(verificarFirmaStripe(cuerpo + ' ', `t=${t},v1=${firmar(t)}`, secreto, 300, t), false);
  assert.equal(verificarFirmaStripe(cuerpo, `t=${t},v1=${firmar(t, cuerpo, 'otro')}`, secreto, 300, t), false);
  assert.equal(verificarFirmaStripe(cuerpo, `t=${t},v1=${firmar(t)}`, secreto, 300, t + 301), false);
  assert.equal(verificarFirmaStripe(cuerpo, null, secreto), false);
  assert.equal(verificarFirmaStripe(cuerpo, 'v1=abc', secreto), false);
});

test('traduce estados de Stripe', () => {
  assert.equal(estadoDesdeStripe('active'), 'activa');
  assert.equal(estadoDesdeStripe('trialing'), 'prueba');
  assert.equal(estadoDesdeStripe('past_due'), 'impagada');
  assert.equal(estadoDesdeStripe('canceled'), 'cancelada');
});

test('normaliza importes a mensual', () => {
  assert.equal(importeMensualDesdeItems([{ quantity: 2, price: { unit_amount: 4900, recurring: { interval: 'month' } } }]), 98);
  assert.equal(importeMensualDesdeItems([{ quantity: 1, price: { unit_amount: 120000, recurring: { interval: 'year' } } }]), 100);
  assert.equal(importeMensualDesdeItems([{ price: { unit_amount: 3000, recurring: { interval: 'month', interval_count: 3 } } }]), 10);
  assert.equal(importeMensualDesdeItems([]), 0);
});
