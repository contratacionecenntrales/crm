import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { crearClienteServidor } from '@/lib/supabase/server';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesChatWeb } from '@/components/ajustes/ChatWeb';
import type { AjustesChat } from '@/lib/chat/tipos';

export const metadata = { title: 'Chat web' };

export default async function PaginaChatWeb({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('chat_widgets')
    .select('clave, activo, titulo, subtitulo, saludo, color, posicion, pedir_telefono, aviso_legal, dominios')
    .eq('subcuenta_id', id).maybeSingle();
  return (
    <ContenedorAjustes ancho="max-w-7xl">
      <TituloAjustes titulo="Chat web"
        subtitulo={soyAdmin ? 'Pon un chat en tu web: los mensajes llegan a Conversaciones y respondes desde allí.' : 'Solo un administrador puede cambiar estos ajustes.'} />
      <AjustesChatWeb subId={id} ajustes={(data as AjustesChat | null) ?? null} soyAdmin={soyAdmin} web={siteUrl()} />
    </ContenedorAjustes>
  );
}
