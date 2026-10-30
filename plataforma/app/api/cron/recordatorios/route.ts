import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { procesarAvisos } from '@/lib/calendario/procesarAvisos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Envía los avisos de cita vencidos. Lo llama un programador cada 5 minutos
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
    return NextResponse.json(await procesarAvisos(50));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
