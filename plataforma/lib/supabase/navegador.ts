'use client';
import { createBrowserClient } from '@supabase/ssr';

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Realtime entra con la sesión del usuario (si no, se une como anónimo y las
// tablas protegidas no envían cambios). Devuelve la función para salir.
export function canalEnDirecto(
  supabase: ReturnType<typeof crearClienteNavegador>,
  crear: (s: ReturnType<typeof crearClienteNavegador>) => ReturnType<ReturnType<typeof crearClienteNavegador>['channel']>,
): () => void {
  let canal: ReturnType<ReturnType<typeof crearClienteNavegador>['channel']> | null = null;
  let fuera = false;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (!fuera) canal = crear(supabase).subscribe();
  })();
  return () => { fuera = true; if (canal) void supabase.removeChannel(canal); };
}
