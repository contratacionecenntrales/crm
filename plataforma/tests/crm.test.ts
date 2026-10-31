import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFiltros, escaparLike, leerFiltros, leerOrden, leerPagina, arrayLiteral, type Constructor } from '../lib/crm/filtros.ts';
import { escribirCsv, leerCsv, normalizarTelefono, slug, sugerirMapeo, detectarSeparador } from '../lib/crm/csv.ts';

// Constructor falso que apunta las llamadas.
class Falso implements Constructor<Falso> {
  llamadas: string[] = [];
  private a(s: string) { this.llamadas.push(s); return this; }
  ilike(c: string, p: string) { return this.a(`ilike ${c} ${p}`); }
  not(c: string, o: string, v: string) { return this.a(`not ${c} ${o} ${v}`); }
  eq(c: string, v: unknown) { return this.a(`eq ${c} ${JSON.stringify(v)}`); }
  neq(c: string, v: unknown) { return this.a(`neq ${c} ${JSON.stringify(v)}`); }
  is(c: string, v: null | boolean) { return this.a(`is ${c} ${v}`); }
  lt(c: string, v: string) { return this.a(`lt ${c} ${v}`); }
  gte(c: string, v: string) { return this.a(`gte ${c} ${v}`); }
  contains(c: string, v: string[]) { return this.a(`cs ${c} ${v.join('|')}`); }
  in(c: string, v: string[]) { return this.a(`in ${c} ${v.join('|')}`); }
  or(f: string) { return this.a(`or ${f}`); }
}

test('leerFiltros ignora basura y limita a 20', () => {
  assert.deepEqual(leerFiltros('no-json'), []);
  assert.deepEqual(leerFiltros('{"a":1}'), []);
  assert.equal(leerFiltros(JSON.stringify(Array.from({ length: 30 }, () => ({ campo: 'nombre', op: 'contiene', valor: 'a' })))).length, 20);
});

test('aplicarFiltros traduce cada tipo de filtro', () => {
  const ahora = new Date('2026-10-29T12:00:00Z');
  const { consulta, descartados } = aplicarFiltros(new Falso(), [
    { campo: 'nombre', op: 'contiene', valor: '50%_off' },
    { campo: 'email', op: 'vacio' },
    { campo: 'etiquetas', op: 'incluye', valor: 'vip' },
    { campo: 'etiquetas', op: 'no_incluye', valor: 'baja "x"' },
    { campo: 'creado', op: 'ultimos_dias', valor: '7' },
    { campo: 'tipo', op: 'es', valor: 'cliente' },
    { campo: 'dnd', op: 'si' },
    { campo: 'campo:tipo_negocio', op: 'es', valor: 'Clínica' },
    { campo: 'empresa', op: 'contiene', valor: 'hotel' },
  ], { ahora, idsEmpresas: { hotel: ['e1', 'e2'] } });
  assert.deepEqual(descartados, []);
  assert.deepEqual(consulta.llamadas, [
    'ilike nombre %50\\%\\_off%',
    'is email null',
    'cs etiquetas vip',
    'not etiquetas cs {"baja \\"x\\""}',
    'gte creado 2026-10-22T12:00:00.000Z',
    'eq tipo "cliente"',
    'eq dnd true',
    'ilike campos->>tipo_negocio Clínica',
    'in empresa_id e1|e2',
  ]);
});

test('aplicarFiltros descarta campos inventados, inyecciones y valores vacíos', () => {
  const { consulta, descartados } = aplicarFiltros(new Falso(), [
    { campo: 'subcuenta_id', op: 'es', valor: 'x' },
    { campo: 'campo:a;drop', op: 'es', valor: 'x' },
    { campo: 'nombre', op: 'contiene', valor: '  ' },
    { campo: 'creado', op: 'ultimos_dias', valor: '-3' },
    { campo: 'creado', op: 'antes', valor: 'mañana' },
    { campo: 'propietario_id', op: 'es', valor: 'no-uuid' },
    { campo: 'nombre', op: 'borrar', valor: 'x' },
  ]);
  assert.equal(descartados.length, 7);
  assert.deepEqual(consulta.llamadas, []);
});

test('empresa sin coincidencias no devuelve nada', () => {
  const { consulta } = aplicarFiltros(new Falso(), [{ campo: 'empresa', op: 'contiene', valor: 'nada' }], { idsEmpresas: {} });
  assert.deepEqual(consulta.llamadas, ['in empresa_id 00000000-0000-0000-0000-000000000000']);
});

test('orden y página tienen valores seguros por defecto', () => {
  assert.deepEqual(leerOrden('nombre.asc'), { columna: 'nombre', asc: true });
  assert.deepEqual(leerOrden('subcuenta_id.asc'), { columna: 'creado', asc: false });
  assert.deepEqual(leerPagina('3', '50'), { pagina: 3, tam: 50, desde: 100, hasta: 149 });
  assert.deepEqual(leerPagina('-1', '9999'), { pagina: 1, tam: 20, desde: 0, hasta: 19 });
  assert.equal(escaparLike('a\\b'), 'a\\\\b');
  assert.equal(arrayLiteral('a,b'), '{"a,b"}');
});

test('leerCsv entiende comillas, saltos de línea y punto y coma', () => {
  const texto = '﻿Nombre;Correo;Notas\r\n"Pérez; Ana";ana@x.com;"Dijo ""hola""\nadiós"\r\n\r\nLuis;luis@x.com;\n';
  assert.equal(detectarSeparador(texto), ';');
  assert.deepEqual(leerCsv(texto), [
    ['Nombre', 'Correo', 'Notas'],
    ['Pérez; Ana', 'ana@x.com', 'Dijo "hola"\nadiós'],
    ['Luis', 'luis@x.com', ''],
  ]);
});

test('escribirCsv escapa y neutraliza fórmulas', () => {
  const csv = escribirCsv(['a', 'b'], [['=HYPERLINK("x")', 'uno, dos'], [['vip', 'nuevo'], null]]);
  assert.equal(csv, '﻿a,b\r\n"\'=HYPERLINK(""x"")","uno, dos"\r\n"vip, nuevo",\r\n');
  assert.deepEqual(leerCsv(csv), [['a', 'b'], ["'=HYPERLINK(\"x\")", 'uno, dos'], ['vip, nuevo', '']]);
});

test('sugerirMapeo reconoce cabeceras habituales en español e inglés', () => {
  assert.deepEqual(
    sugerirMapeo(['First Name', 'Apellidos', 'Correo electrónico', 'Teléfono', 'Company Name', 'Tags', 'Tipo de negocio', 'Raro'],
      [{ clave: 'tipo_negocio', nombre: 'Tipo de negocio' }]),
    ['nombre', 'apellidos', 'email', 'telefono', 'empresa', 'etiquetas', 'campo:tipo_negocio', ''],
  );
});

test('teléfonos y claves', () => {
  assert.equal(normalizarTelefono('613 94 00 00'), '+34613940000');
  assert.equal(normalizarTelefono('0044 20 7946 0000'), '+442079460000');
  assert.equal(normalizarTelefono('+34 (632) 22-86-08'), '+34632228608');
  assert.equal(normalizarTelefono(''), '');
  assert.equal(slug('Tipo de Negocio'), 'tipo_de_negocio');
  assert.equal(slug('2º contacto'), 'c_2_contacto');
});

test('los filtros negativos incluyen los vacíos (NULL)', () => {
  const { consulta } = aplicarFiltros(new Falso(), [
    { campo: 'campo:sector', op: 'no_es', valor: 'Hotel, spa' },
    { campo: 'campo:sector', op: 'no_contiene', valor: 'x' },
    { campo: 'nombre', op: 'no_contiene', valor: 'y' },
  ]);
  assert.deepEqual(consulta.llamadas, [
    'or campos->>sector.is.null,campos->>sector.not.ilike."Hotel, spa"',
    'or campos->>sector.is.null,campos->>sector.not.ilike."%x%"',
    'not nombre ilike %y%',
  ]);
});

test('los filtros de fecha cortan a medianoche en la zona de la subcuenta', () => {
  const { consulta } = aplicarFiltros(new Falso(), [
    { campo: 'creado', op: 'despues', valor: '2026-07-01' },
    { campo: 'fecha_nacimiento', op: 'antes', valor: '2000-01-01' },
  ], { zona: 'Europe/Madrid' });
  assert.deepEqual(consulta.llamadas, ['gte creado 2026-06-30T22:00:00.000Z', 'lt fecha_nacimiento 2000-01-01']);
});
