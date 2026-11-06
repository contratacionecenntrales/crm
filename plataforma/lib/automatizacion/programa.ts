import type { Operador, Paso, PasoSi, Regla } from './tipos.ts';

// Las ramas «si / si no» se guardan anidadas (cómodas de editar) y se ejecutan
// compiladas a una lista plana con saltos hacia delante. Así el puntero de la
// ejecución sigue siendo un número y las esperas funcionan igual.

export type Instr = Exclude<Paso, PasoSi> | { tipo: '_si'; modo: 'todas' | 'alguna'; reglas: Regla[]; saltar: number } | { tipo: '_ir'; a: number };

export function compilar(pasos: Paso[]): Instr[] {
  const out: Instr[] = [];
  const emitir = (lista: Paso[]) => {
    for (const p of lista) {
      if (p.tipo !== 'si') { out.push(p); continue; }
      const iSi = out.length;
      out.push({ tipo: '_si', modo: p.modo, reglas: p.reglas, saltar: -1 });
      emitir(p.si);
      const iIr = out.length;
      out.push({ tipo: '_ir', a: -1 });
      (out[iSi] as { saltar: number }).saltar = out.length;
      emitir(p.no);
      (out[iIr] as { a: number }).a = out.length;
    }
  };
  emitir(pasos);
  return out;
}

// Valor de un camino «a.b.c» dentro de un objeto (null si no existe).
export function camino(obj: unknown, ruta: string[]): unknown {
  let x: unknown = obj;
  for (const k of ruta) {
    if (x === null || x === undefined) return null;
    if (Array.isArray(x) && /^\d+$/.test(k)) x = x[Number(k)];
    else if (typeof x === 'object') x = (x as Record<string, unknown>)[k];
    else return null;
  }
  return x ?? null;
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const numero = (v: unknown) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));

export function cumple(r: Regla, valor: unknown): boolean {
  const esperado = r.valor.trim().toLowerCase();
  const op: Operador = r.operador;
  if (Array.isArray(valor)) {
    const l = valor.map((x) => texto(x).trim().toLowerCase());
    switch (op) {
      case 'vacio': return l.length === 0;
      case 'no_vacio': return l.length > 0;
      case 'igual': case 'contiene': return l.includes(esperado) || (op === 'contiene' && l.some((x) => x.includes(esperado)));
      case 'distinto': case 'no_contiene': return !l.includes(esperado);
      case 'mayor': return l.length > numero(r.valor);
      case 'menor': return l.length < numero(r.valor);
    }
  }
  const v = texto(valor).trim().toLowerCase();
  switch (op) {
    case 'vacio': return v === '';
    case 'no_vacio': return v !== '';
    case 'igual': return v === esperado;
    case 'distinto': return v !== esperado;
    case 'contiene': return v.includes(esperado);
    case 'no_contiene': return !v.includes(esperado);
    case 'mayor': { const a = numero(v); const b = numero(r.valor); return Number.isFinite(a) && Number.isFinite(b) && a > b; }
    case 'menor': { const a = numero(v); const b = numero(r.valor); return Number.isFinite(a) && Number.isFinite(b) && a < b; }
  }
}

export function evaluar(reglas: Regla[], modo: 'todas' | 'alguna', valor: (campo: string) => unknown): boolean {
  const r = reglas.map((x) => cumple(x, valor(x.campo)));
  return modo === 'alguna' ? r.some(Boolean) : r.every(Boolean);
}

// Sustituye {{a.b.c}}. Con modo «json» el valor va escapado para meterlo dentro
// de una cadena JSON; con «url», codificado para una URL.
export function rellenar(plantilla: string, valor: (campo: string) => unknown, modo: 'texto' | 'json' | 'url' = 'texto'): string {
  return plantilla.replace(/\{\{\s*([a-z_]+(?:\.[a-z0-9_]+)+)\s*\}\}/gi, (_, k: string) => {
    const t = texto(valor(k.toLowerCase()));
    return modo === 'json' ? JSON.stringify(t).slice(1, -1) : modo === 'url' ? encodeURIComponent(t) : t;
  });
}
