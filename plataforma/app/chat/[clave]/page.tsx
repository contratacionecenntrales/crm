import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { CLAVE_CHAT, type ConfigChat } from '@/lib/chat/tipos';
import { VentanaChat } from '@/components/chat/VentanaChat';

export const metadata = { title: 'Chat', robots: { index: false } };

// Ventana del chat web: se abre dentro del globo que la subcuenta pega en su web.
export default async function PaginaChat({ params, searchParams }: { params: Promise<{ clave: string }>; searchParams: Promise<{ origen?: string }> }) {
  const { clave } = await params;
  const { origen = '' } = await searchParams;
  const config = CLAVE_CHAT.test(clave)
    ? ((await crearClienteAnonimo().rpc('chat_config', { p_clave: clave })).data as ConfigChat | null)
    : null;
  if (!config) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white p-6 text-center font-sans text-sm text-[#475467]">
        Este chat no está disponible ahora mismo.
      </main>
    );
  }
  return <VentanaChat clave={clave} config={config} origen={origen.slice(0, 200)} />;
}
