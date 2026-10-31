import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aUnidadMinima, desdeUnidadMinima, totales } from '../lib/pagos/calculo.ts';
import { estadoVisible } from '../lib/pagos/tipos.ts';

test('totales con el mismo redondeo que la base de datos', () => {
  assert.deepEqual(totales([{ cantidad: 2, precio: 60, impuesto: 21 }, { cantidad: 1, precio: 10.5, impuesto: 0 }]), { subtotal: 130.5, impuestos: 25.2, total: 155.7 });
  // 3 × 0,10 € al 21 %: 0,063 → 0,06 por línea
  assert.deepEqual(totales([{ cantidad: 3, precio: 0.1, impuesto: 21 }]), { subtotal: 0.3, impuestos: 0.06, total: 0.36 });
  assert.deepEqual(totales([]), { subtotal: 0, impuestos: 0, total: 0 });
});

test('unidades mínimas de Stripe', () => {
  assert.equal(aUnidadMinima(155.7, 'EUR'), 15570);
  assert.equal(aUnidadMinima(0.29, 'usd'), 29);
  assert.equal(aUnidadMinima(1500, 'JPY'), 1500);
  assert.equal(desdeUnidadMinima(15570, 'EUR'), 155.7);
  assert.equal(aUnidadMinima(10, 'KWD'), 10000);
  assert.equal(desdeUnidadMinima(10000, 'KWD'), 10);
  assert.equal(aUnidadMinima(1000, 'ISK'), 100000);
  assert.equal(aUnidadMinima(500, 'XPF'), 500);
});

test('estado visible', () => {
  assert.equal(estadoVisible({ estado: 'enviada', vencimiento: '2026-10-01', cobrado: 0 }, '2026-10-31'), 'vencida');
  assert.equal(estadoVisible({ estado: 'enviada', vencimiento: null, cobrado: 10 }, '2026-10-31'), 'parcial');
  assert.equal(estadoVisible({ estado: 'pagada', vencimiento: '2026-10-01', cobrado: 10 }, '2026-10-31'), 'pagada');
});
