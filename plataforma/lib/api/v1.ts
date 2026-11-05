import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteAdmin } from '@/lib/supabase/admin';

// API REST v1 para integraciones privadas. Cada petición lleva
//   Authorization: Bearer mtk_…
// y trabaja sobre UNA subcuenta (en la ruta). El cliente admin solo se usa
// después de validar la clave, y todas las consultas filtran por esa subcuenta.

import type { Permiso } from './permisos';
export type { Permiso };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function error(estado: number, codigo: string, mensaje: string, extra?: Record<string, string>) {
  return NextResponse.json({ error: { codigo, mensaje } }, { status: estado, headers: { 'Cache-Control': 'no-store', ...extra } });
}
export const ok = (datos: unknown, estado = 200) => NextResponse.json(datos, { status: estado, headers: { 'Cache-Control': 'no-store' } });

const HTTP: Record<string, [number, string]> = { no_autorizado: [401, 'no_autorizado'], prohibido: [403, 'prohibido'], limite: [429, 'limite'] };

export interface Contexto { admin: SupabaseClient; sub: string; claveId: string }

export async function conClave(request: NextRequest, sub: string, permiso: Permiso, fn: (c: Contexto) => Promise<NextResponse>) {
  const admin = crearClienteAdmin();
  if (!admin) return error(503, 'sin_configurar', 'La API no está configurada en el servidor (falta SUPABASE_SERVICE_ROLE_KEY).');
  const m = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(\S+)$/i);
  if (!m) return error(401, 'no_autorizado', 'Falta la cabecera «Authorization: Bearer <clave>».', { 'WWW-Authenticate': 'Bearer' });
  if (!UUID.test(sub)) return error(404, 'no_encontrado', 'Subcuenta no válida.');
  const { data, error: e } = await admin.rpc('api_autenticar', { p_token: m[1], p_subcuenta: sub, p_permiso: permiso });
  if (e) {
    const [estado, codigo] = HTTP[e.hint ?? ''] ?? [500, 'error'];
    return error(estado, codigo, estado === 500 ? 'Error interno al validar la clave.' : e.message,
      estado === 429 ? { 'Retry-After': '60' } : estado === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined);
  }
  const { data: permitida } = await admin.rpc('api_subcuenta_permitida', { p_subcuenta: sub });
  if (!permitida) return error(403, 'prohibido', 'La API no está disponible para esta subcuenta (agencia suspendida o plan sin API).');
  try {
    return await fn({ admin, sub, claveId: (data as { clave_id: string }).clave_id });
  } catch (x) {
    console.error('API v1', x);
    return error(500, 'error', 'Error interno.');
  }
}

export async function leerJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return null;
  const texto = await request.text();
  if (texto.length > 100_000) return null;
  try {
    const v = JSON.parse(texto);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// Errores de la base de datos → respuesta legible (sin detalles internos).
export function errorBd(e: { code?: string; message?: string }) {
  if (e.code === '23505') return error(409, 'duplicado', 'Ya existe un registro con esos datos (por ejemplo, el mismo correo).');
  if (e.code === '23503') return error(422, 'referencia', 'Alguna referencia no existe en esta subcuenta (contacto, embudo o etapa).');
  if (e.code === '23514' || e.code === '22P02') return error(422, 'invalido', 'Algún dato no cumple el formato esperado.');
  return error(500, 'error', 'Error interno.');
}

export function paginacion(url: URL) {
  const limite = Math.min(100, Math.max(1, Number(url.searchParams.get('limite')) || 20));
  const pagina = Math.max(1, Math.floor(Number(url.searchParams.get('pagina')) || 1));
  return { limite, pagina, desde: (pagina - 1) * limite, hasta: pagina * limite - 1 };
}

export const COLUMNAS_CONTACTO_API = 'id, nombre, apellidos, email, telefono, tipo, fuente, direccion, ciudad, provincia, codigo_postal, pais, web, etiquetas, dnd, propietario_id, creado, actualizado';
export const COLUMNAS_OPORTUNIDAD_API = 'id, contacto_id, embudo_id, etapa_id, nombre, valor, estado, fuente, motivo_perdida, propietario_id, creado, actualizado';
