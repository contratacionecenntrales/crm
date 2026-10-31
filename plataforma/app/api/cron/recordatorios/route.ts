import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { procesarAvisos } from '@/lib/calendario/procesarAvisos';
import { procesarAutomatizaciones } from '@/lib/automatizacion/motor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Envía los avisos de cita vencidos y ejecuta los pasos de automatización que tocan. Lo llama un programador cada 5 minutos
// (Vercel Cron, o pg_cron de Supabase) con «Authorization: Bearer <CRON_SECRET>».
async function ejecutar(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: 'Falta CRON_SECRET en el servidor.' }, { status: 503 });
  const recibido = Buffer.from(req.headers.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    // Mensajes que se quedaron «enviando» (proceso cortado): se marcan como no
    // enviados para que se puedan reintentar desde Conversaciones.
    const admin = crearClienteAdmin();
    if (admin) {
      await admin.from('conv_mensajes').update({ estado: 'fallido', error: 'No se pudo confirmar el envío. Reinténtalo.' })
        .eq('estado', 'pendiente').eq('direccion', 'saliente').lt('actualizado', new Date(Date.now() - 10 * 60_000).toISOString());
    }
    const avisos = await procesarAvisos(50);
    const automatizaciones = await procesarAutomatizaciones(50);
    return NextResponse.json({ avisos, automatizaciones });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
