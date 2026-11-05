import 'server-only';
import { headers } from 'next/headers';

// Límite de peticiones por IP para lo público (formularios, chat). Va en
// memoria de cada instancia del servidor: frena a un mismo script o persona;
// los topes de la base de datos siguen siendo el límite global.
const ventanas = new Map<string, number[]>();

export async function ipCliente(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'desconocida').trim().slice(0, 64);
}

// true si aún se permite (y lo cuenta).
export async function dentroDelLimite(clave: string, maximo: number, segundos: number): Promise<boolean> {
  const k = `${clave}:${await ipCliente()}`;
  const ahora = Date.now();
  const lista = (ventanas.get(k) ?? []).filter((t) => t > ahora - segundos * 1000);
  if (lista.length >= maximo) { ventanas.set(k, lista); return false; }
  lista.push(ahora);
  ventanas.set(k, lista);
  if (ventanas.size > 20000) for (const [c, v] of ventanas) if (!v.some((t) => t > ahora - 3600_000)) ventanas.delete(c);
  return true;
}
