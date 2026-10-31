import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { CLAVE_CHAT, origenPermitido, type ConfigChat } from '@/lib/chat/tipos';

// Lo mínimo que necesita el globo para pintarse en la web del cliente.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' };

export async function GET(request: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  if (!CLAVE_CHAT.test(clave)) return NextResponse.json({ error: 'No disponible' }, { status: 404, headers: CORS });
  const { data } = await crearClienteAnonimo().rpc('chat_config', { p_clave: clave });
  const c = data as ConfigChat | null;
  if (!c) return NextResponse.json({ error: 'No disponible' }, { status: 404, headers: CORS });
  let host = '';
  try { host = new URL(request.headers.get('origin') ?? '').hostname; } catch { /* sin origen */ }
  if (c.dominios.length && !origenPermitido(c.dominios, host)) {
    return NextResponse.json({ error: 'Web no autorizada' }, { status: 403, headers: CORS });
  }
  return NextResponse.json({ titulo: c.titulo, color: c.color, posicion: c.posicion }, { headers: CORS });
}
