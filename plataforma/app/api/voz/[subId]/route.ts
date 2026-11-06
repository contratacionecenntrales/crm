import { NextResponse, type NextRequest } from 'next/server';
import { contestarLlamada, peticionTwilio } from '@/lib/voz/llamada';

// Llamadas entrantes al número de Twilio de la subcuenta.
// URL para la consola de Twilio («A call comes in»): <web>/api/voz/<id de la subcuenta>
export async function POST(req: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  const p = await peticionTwilio(req, subId, '');
  if (p instanceof NextResponse) return p;
  return contestarLlamada(subId, p.datos);
}
