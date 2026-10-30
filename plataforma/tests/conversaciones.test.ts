import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { segmentosSms } from '../lib/conversaciones/tipos.ts';
import { estadoTwilio, firmaTwilio, firmaTwilioValida, firmaMailgunValida, separarRemitente } from '../lib/conversaciones/firmas.ts';

test('firma de Twilio: URL + parámetros ordenados, HMAC-SHA1 en base64', () => {
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
  // Cadena firmada escrita a mano, en el orden que exige Twilio.
  const cadena = url + 'CallSidCA1234567890ABCDE' + 'Caller+12349013030' + 'Digits1234' + 'From+12349013030' + 'To+18005551212';
  const esperada = createHmac('sha1', '12345').update(cadena).digest('base64');
  assert.equal(firmaTwilio(url, { To: params.To, Digits: params.Digits, CallSid: params.CallSid, From: params.From, Caller: params.Caller }, '12345'), esperada);
  assert.ok(firmaTwilioValida(url, params, esperada, '12345'));
  assert.ok(!firmaTwilioValida(url, { ...params, Digits: '9' }, esperada, '12345'));
  assert.ok(!firmaTwilioValida(url, params, null, '12345'));
  assert.ok(!firmaTwilioValida(url, params, esperada, ''));
});

test('firma de Mailgun con caducidad', () => {
  const ahora = 1_800_000_000_000;
  const ts = String(ahora / 1000);
  const firma = createHmac('sha256', 'clave').update(ts + 'tok').digest('hex');
  assert.ok(firmaMailgunValida('clave', ts, 'tok', firma, ahora));
  assert.ok(!firmaMailgunValida('otra', ts, 'tok', firma, ahora));
  assert.ok(!firmaMailgunValida('clave', ts, 'tok', firma, ahora + 16 * 60_000)); // caducada
  assert.ok(!firmaMailgunValida('clave', ts, 'tok', 'abc', ahora));
});

test('remitente y estados', () => {
  assert.deepEqual(separarRemitente('"Eva Ruiz" <Eva@Mail.com>'), { nombre: 'Eva Ruiz', email: 'eva@mail.com' });
  assert.deepEqual(separarRemitente('eva@mail.com'), { nombre: '', email: 'eva@mail.com' });
  assert.equal(estadoTwilio('delivered'), 'entregado');
  assert.equal(estadoTwilio('undelivered'), 'fallido');
  assert.equal(estadoTwilio('received'), null);
});

test('segmentos de SMS', () => {
  assert.deepEqual(segmentosSms(''), { n: 0, max: 160 });
  assert.equal(segmentosSms('a'.repeat(160)).n, 1);
  assert.equal(segmentosSms('a'.repeat(161)).n, 2);
  assert.equal(segmentosSms('Hola, ¿qué tal? Ñoño €').max, 160); // todo GSM (é, Ñ, ñ, ¿, € sí; ú no)
  assert.equal(segmentosSms('Hola 😀').max, 70);
  assert.equal(segmentosSms('ó'.repeat(71)).n, 2); // «ó» no es GSM
});
