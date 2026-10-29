import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { crearClienteServidor } from '@/lib/supabase/server';

// Destino de los enlaces de correo de Supabase (invitación, recuperación,
// confirmación). Las plantillas de correo tienen que apuntar aquí con
// token_hash y type: ver README.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const tipo = searchParams.get('type') as EmailOtpType | null;
  const codigo = searchParams.get('code');
  const pedido = searchParams.get('siguiente') ?? '/';
  const siguiente = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/';

  const supabase = await crearClienteServidor();
  let error: string | null = null;

  if (tokenHash && tipo) {
    const r = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    error = r.error?.message ?? null;
  } else if (codigo) {
    const r = await supabase.auth.exchangeCodeForSession(codigo);
    error = r.error?.message ?? null;
  } else {
    error = 'Enlace incompleto.';
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('El enlace no es válido o ha caducado.')}`);
  }
  // Invitaciones y recuperaciones siempre pasan por crear contraseña.
  const destino = tipo === 'invite' || tipo === 'recovery' ? '/auth/nueva-clave' : siguiente;
  return NextResponse.redirect(`${origin}${destino}`);
}
