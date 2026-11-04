import type { NextRequest } from 'next/server';
import { COLUMNAS_CONTACTO_API, conClave, error, errorBd, leerJson, ok, paginacion } from '@/lib/api/v1';
import { esquemaContactoApi, primerProblema } from '@/lib/api/esquemas';
import { escaparLike } from '@/lib/crm/filtros';
import { normalizarTelefono } from '@/lib/crm/csv';

type P = { params: Promise<{ sub: string }> };

// GET /api/v1/subcuentas/{sub}/contactos?q=&limite=&pagina=
export async function GET(request: NextRequest, { params }: P) {
  const { sub } = await params;
  return conClave(request, sub, 'contactos.leer', async ({ admin }) => {
    const url = new URL(request.url);
    const { limite, pagina, desde, hasta } = paginacion(url);
    let q = admin.from('crm_contactos').select(COLUMNAS_CONTACTO_API, { count: 'exact' }).eq('subcuenta_id', sub);
    const texto = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 100);
    if (texto) q = q.ilike('busqueda', `%${escaparLike(texto)}%`);
    const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
    if (email) q = q.eq('email', email);
    const { data, count, error: e } = await q.order('creado', { ascending: false }).order('id').range(desde, hasta);
    if (e) return errorBd(e);
    return ok({ datos: data, total: count ?? 0, pagina, limite });
  });
}

// POST /api/v1/subcuentas/{sub}/contactos
export async function POST(request: NextRequest, { params }: P) {
  const { sub } = await params;
  return conClave(request, sub, 'contactos.escribir', async ({ admin }) => {
    const cuerpo = await leerJson(request);
    if (!cuerpo) return error(400, 'json', 'El cuerpo tiene que ser JSON (Content-Type: application/json).');
    const d = esquemaContactoApi.safeParse(cuerpo);
    if (!d.success) return error(422, 'invalido', primerProblema(d.error));
    const v = d.data;
    if (!v.nombre && !v.apellidos && !v.email && !v.telefono) return error(422, 'invalido', 'Indica al menos nombre, correo o teléfono.');
    const { data: s } = await admin.from('subcuentas').select('prefijo').eq('id', sub).single();
    const telefono = v.telefono ? normalizarTelefono(v.telefono, (s?.prefijo as string) ?? '+34') : '';
    if (telefono && !/^\+[0-9]{6,15}$/.test(telefono)) return error(422, 'invalido', 'telefono: no válido');
    const { data, error: e } = await admin.from('crm_contactos')
      .insert({ ...v, telefono, email: v.email ?? null, fuente: v.fuente || 'API', subcuenta_id: sub, creado_por: null })
      .select(COLUMNAS_CONTACTO_API).single();
    if (e) return errorBd(e);
    return ok({ datos: data }, 201);
  });
}
