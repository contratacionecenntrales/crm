import { NextResponse, type NextRequest } from 'next/server';
import { contestarTurno, peticionTwilio } from '@/lib/voz/llamada';

export const maxDuration = 30;

// Twilio envía aquí lo que ha dicho el cliente (SpeechResult).
export async function POST(req: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  const p = await peticionTwilio(req, subId, '/turno');
  if (p instanceof NextResponse) return p;
  const silencios = Math.min(Number(req.nextUrl.searchParams.get('s') ?? 0) || 0, 5);
  return contestarTurno(subId, p.datos, silencios);
}
