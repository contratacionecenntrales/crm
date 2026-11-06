import type { Paso } from './tipos.ts';

// Rutas dentro del árbol de pasos. Una lista: '' (raíz) o '<nodo>.si' / '<nodo>.no'.
// Un nodo: '<lista>.<índice>' (sin el punto inicial en la raíz), p. ej. '2', '2.si.0'.

const trozos = (r: string) => (r ? r.split('.') : []);
export const rutaNodo = (lista: string, i: number) => (lista ? `${lista}.${i}` : String(i));

export function listaEn(pasos: Paso[], lista: string): Paso[] | null {
  let l: Paso[] = pasos;
  const t = trozos(lista);
  for (let k = 0; k < t.length; k += 2) {
    const n = l[Number(t[k])];
    if (!n || n.tipo !== 'si' || (t[k + 1] !== 'si' && t[k + 1] !== 'no')) return null;
    l = n[t[k + 1] as 'si' | 'no'];
  }
  return l;
}

const separar = (nodo: string) => { const t = trozos(nodo); return { lista: t.slice(0, -1).join('.'), i: Number(t[t.length - 1]) }; };

export function obtener(pasos: Paso[], nodo: string): Paso | null {
  const { lista, i } = separar(nodo);
  return listaEn(pasos, lista)?.[i] ?? null;
}

// Aplica un cambio a la lista que contiene una ruta, copiando solo el camino.
function conLista(pasos: Paso[], lista: string, f: (l: Paso[]) => Paso[]): Paso[] {
  const t = trozos(lista);
  if (!t.length) return f(pasos);
  const [cab, rama, ...resto] = t;
  return pasos.map((p, j) => {
    if (j !== Number(cab) || p.tipo !== 'si') return p;
    const r = rama as 'si' | 'no';
    return { ...p, [r]: conLista(p[r], resto.join('.'), f) };
  });
}

export const insertar = (pasos: Paso[], lista: string, i: number, nuevo: Paso) => conLista(pasos, lista, (l) => [...l.slice(0, i), nuevo, ...l.slice(i)]);
export const reemplazar = (pasos: Paso[], nodo: string, nuevo: Paso) => { const { lista, i } = separar(nodo); return conLista(pasos, lista, (l) => l.map((x, j) => (j === i ? nuevo : x))); };
export const quitar = (pasos: Paso[], nodo: string) => { const { lista, i } = separar(nodo); return conLista(pasos, lista, (l) => l.filter((_, j) => j !== i)); };
export function mover(pasos: Paso[], nodo: string, d: -1 | 1): { pasos: Paso[]; nodo: string } {
  const { lista, i } = separar(nodo);
  const l = listaEn(pasos, lista);
  if (!l || i + d < 0 || i + d >= l.length) return { pasos, nodo };
  return { pasos: conLista(pasos, lista, (x) => { const n = [...x]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }), nodo: rutaNodo(lista, i + d) };
}
export const profundidad = (lista: string) => trozos(lista).length / 2;
