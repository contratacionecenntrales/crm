import { COLUMNAS_BASE, OPERADORES, type TipoColumna } from './columnas.ts';
import type { Filtro } from './tipos';
import { instante } from '../calendario/tiempo.ts';

// Interfaz mínima del constructor de consultas de supabase-js que usamos.
// Así la lógica se prueba sin red, con un constructor falso.
export interface Constructor<T> {
  ilike(col: string, patron: string): T;
  not(col: string, op: string, valor: string): T;
  eq(col: string, valor: unknown): T;
  neq(col: string, valor: unknown): T;
  is(col: string, valor: null | boolean): T;
  lt(col: string, valor: string): T;
  gte(col: string, valor: string): T;
  contains(col: string, valor: string[]): T;
  in(col: string, valores: string[]): T;
  or(filtros: string): T;
}

const MAX_FILTROS = 20;

// Escapa los comodines de LIKE para que el texto del usuario se busque literal.
export const escaparLike = (v: string) => v.replace(/[\\%_]/g, (c) => '\\' + c);

// Literal de array de Postgres con un único elemento, entrecomillado.
// Valor entrecomillado para usarlo dentro de .or() de PostgREST (comas, paréntesis…).
export const citaOr = (v: string) => `"${v.replace(/["\\]/g, (c) => '\\' + c)}"`;

export const arrayLiteral = (v: string) => `{"${v.replace(/["\\]/g, (c) => '\\' + c)}"}`;

export function leerFiltros(crudo: string | undefined | null): Filtro[] {
  if (!crudo) return [];
  try {
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter((f) => f && typeof f.campo === 'string' && typeof f.op === 'string')
      .slice(0, MAX_FILTROS)
      .map((f) => ({ campo: f.campo, op: f.op, valor: typeof f.valor === 'string' ? f.valor.slice(0, 200) : undefined }));
  } catch {
    return [];
  }
}

function tipoDe(campo: string): TipoColumna | null {
  if (/^campo:[a-z][a-z0-9_]{0,49}$/.test(campo)) return 'personalizado';
  return COLUMNAS_BASE.find((c) => c.clave === campo)?.tipo ?? null;
}

const COLUMNA_SQL: Record<string, string> = { empresa: 'empresa_id' };

/**
 * Aplica los filtros a la consulta. `idsEmpresas` resuelve el filtro por
 * nombre de empresa (se hace con una consulta previa a crm_empresas).
 * Devuelve la consulta y los filtros descartados por no ser válidos.
 */
export function aplicarFiltros<T extends Constructor<T>>(
  q: T,
  filtros: Filtro[],
  opciones: { ahora?: Date; idsEmpresas?: Record<string, string[]>; zona?: string } = {},
): { consulta: T; descartados: Filtro[] } {
  const ahora = opciones.ahora ?? new Date();
  const descartados: Filtro[] = [];

  for (const f of filtros) {
    const tipo = tipoDe(f.campo);
    const def = tipo ? OPERADORES[tipo].find((o) => o.op === f.op) : null;
    const valor = (f.valor ?? '').trim();
    if (!tipo || !def || (!def.sinValor && valor === '')) {
      descartados.push(f);
      continue;
    }
    const col = tipo === 'personalizado' ? `campos->>${f.campo.slice(6)}` : COLUMNA_SQL[f.campo] ?? f.campo;
    const patron = `%${escaparLike(valor.toLowerCase())}%`;

    switch (tipo) {
      case 'texto':
      case 'texto_nulo':
      case 'personalizado': {
        if (f.op === 'contiene') q = q.ilike(col, patron);
        // Las negativas incluyen los vacíos (NULL): «no contiene X» también es quien no tiene nada.
        else if (f.op === 'no_contiene') q = tipo === 'texto' ? q.not(col, 'ilike', patron) : q.or(`${col}.is.null,${col}.not.ilike.${citaOr(patron)}`);
        else if (f.op === 'es') q = q.ilike(col, escaparLike(valor));
        else if (f.op === 'no_es') q = tipo === 'texto' ? q.not(col, 'ilike', escaparLike(valor)) : q.or(`${col}.is.null,${col}.not.ilike.${citaOr(escaparLike(valor))}`);
        else if (f.op === 'vacio') q = tipo === 'texto' ? q.eq(col, '') : tipo === 'texto_nulo' ? q.is(col, null) : q.or(`${col}.is.null,${col}.eq.`);
        else if (f.op === 'no_vacio') q = tipo === 'texto' ? q.neq(col, '') : tipo === 'texto_nulo' ? q.not(col, 'is', 'null') : q.not(col, 'is', 'null').neq(col, '');
        break;
      }
      case 'empresa': {
        if (f.op === 'vacio') q = q.is(col, null);
        else if (f.op === 'no_vacio') q = q.not(col, 'is', 'null');
        else {
          const ids = opciones.idsEmpresas?.[valor.toLowerCase()] ?? [];
          // Sin empresas coincidentes no debe salir ningún contacto.
          q = q.in(col, ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        }
        break;
      }
      case 'etiquetas': {
        if (f.op === 'incluye') q = q.contains(col, [valor]);
        else if (f.op === 'no_incluye') q = q.not(col, 'cs', arrayLiteral(valor));
        else if (f.op === 'vacio') q = q.eq(col, '{}');
        else q = q.neq(col, '{}');
        break;
      }
      case 'fecha': {
        if (f.op === 'ultimos_dias') {
          const n = Number(valor);
          if (!Number.isInteger(n) || n < 1 || n > 3650) {
            descartados.push(f);
            continue;
          }
          q = q.gte(col, new Date(ahora.getTime() - n * 86_400_000).toISOString());
        } else if (f.op === 'antes' || f.op === 'despues') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
            descartados.push(f);
            continue;
          }
          // Las columnas con hora se cortan a medianoche en la zona de la subcuenta.
          const corte = col !== 'fecha_nacimiento' && opciones.zona ? instante(valor, '00:00', opciones.zona).toISOString() : valor;
          q = f.op === 'antes' ? q.lt(col, corte) : q.gte(col, corte);
        } else if (f.op === 'vacio') q = q.is(col, null);
        else q = q.not(col, 'is', 'null');
        break;
      }
      case 'seleccion': {
        if (f.op === 'vacio') q = q.is(col, null);
        else if (f.campo === 'propietario_id' && !/^[0-9a-f-]{36}$/i.test(valor)) {
          descartados.push(f);
          continue;
        } else q = f.op === 'es' ? q.eq(col, valor) : q.or(`${col}.is.null,${col}.neq.${citaOr(valor)}`);
        break;
      }
      case 'booleano':
        q = q.eq(col, f.op === 'si');
        break;
    }
  }
  return { consulta: q, descartados };
}

const ORDENABLES = new Set(COLUMNAS_BASE.filter((c) => c.ordenable).map((c) => c.clave));

export function leerOrden(crudo: string | undefined | null): { columna: string; asc: boolean } {
  const [columna, dir] = (crudo ?? '').split('.');
  if (columna && ORDENABLES.has(columna)) return { columna, asc: dir === 'asc' };
  return { columna: 'creado', asc: false };
}

export function leerPagina(p: string | undefined, n: string | undefined) {
  const tam = [20, 50, 100].includes(Number(n)) ? Number(n) : 20;
  const pagina = Math.max(1, Math.min(10_000, Number.parseInt(p ?? '1', 10) || 1));
  return { pagina, tam, desde: (pagina - 1) * tam, hasta: pagina * tam - 1 };
}
