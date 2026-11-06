import { after, NextResponse, type NextRequest } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { dentroDelLimite } from '@/lib/red/limite';
import { camino } from '@/lib/automatizacion/programa';

export const dynamic = 'force-dynamic';

// Webhook entrante de un flujo: POST con un objeto JSON. Identifica (o crea) el
// contacto con los campos configurados y mete una ejecución del flujo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{40}$/.test(token)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!(await dentroDelLimite('hook', 120, 60))) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });
  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 503 });
  const texto = await req.text();
  if (texto.length > 65_536) return NextResponse.json({ error: 'El cuerpo supera 64 KB' }, { status: 413 });
  let datos: unknown;
  try { datos = JSON.parse(texto || '{}'); } catch { return NextResponse.json({ error: 'El cuerpo tiene que ser JSON' }, { status: 400 }); }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return NextResponse.json({ error: 'El JSON tiene que ser un objeto' }, { status: 400 });

  const { data: f } = await admin.from('aut_flujos').select('filtro').eq('webhook_token', token).eq('disparador', 'webhook').eq('activo', true).maybeSingle();
  if (!f) return NextResponse.json({ error: 'Webhook no encontrado o flujo desactivado' }, { status: 404 });
  const filtro = (f.filtro ?? {}) as Record<string, string>;
  const leer = (campo: string | undefined, def: string) => {
    const v = camino(datos, String(campo || def).split('.').filter(Boolean));
    return typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 200) : '';
  };
  const { data: id, error } = await admin.rpc('aut_webhook_entrante', {
    p_token: token, p_datos: datos, p_email: leer(filtro.campo_email, 'email'), p_telefono: leer(filtro.campo_telefono, 'telefono'), p_nombre: leer(filtro.campo_nombre, 'nombre'),
  });
  if (error) {
    const estado = error.code === 'P0002' ? 404 : error.code === '23514' ? 422 : 500;
    return NextResponse.json({ error: estado === 500 ? 'Error interno' : error.message }, { status: estado });
  }
  // Ejecuta enseguida (el cron la recogería igualmente).
  if (id) after(async () => {
    try { const { procesarAutomatizaciones } = await import('@/lib/automatizacion/motor'); await procesarAutomatizaciones(1, id as string); } catch { /* el cron reintenta */ }
  });
  return NextResponse.json({ ok: true, ejecucion: id ?? null, aviso: id ? undefined : 'El contacto ya estaba en este flujo.' });
}
