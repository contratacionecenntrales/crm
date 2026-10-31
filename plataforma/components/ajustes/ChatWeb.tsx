'use client';
import { useActionState, useState, useTransition } from 'react';
import { ExternalLink, MessageSquare, RefreshCw, Send, X } from 'lucide-react';
import { guardarChatWeb, renovarClaveChat } from '@/app/subcuenta/[id]/configuracion/acciones-chat';
import { SeccionAjuste, Interruptor } from '@/components/ajustes/Piezas';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { AJUSTES_CHAT_VACIOS, codigoInsercion, type AjustesChat } from '@/lib/chat/tipos';
import type { Resultado } from '@/lib/tipos';

export function AjustesChatWeb({ subId, ajustes, soyAdmin, web }: { subId: string; ajustes: AjustesChat | null; soyAdmin: boolean; web: string }) {
  const a = { ...AJUSTES_CHAT_VACIOS, ...(ajustes ?? {}) };
  const [estado, accion] = useActionState(guardarChatWeb.bind(null, subId), null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  // Vista previa en vivo de lo que se está escribiendo.
  const [vista, setVista] = useState({ titulo: a.titulo, subtitulo: a.subtitulo, saludo: a.saludo, color: a.color, posicion: a.posicion });
  const poner = (k: keyof typeof vista) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setVista((v) => ({ ...v, [k]: e.target.value }));
  const off = !soyAdmin;
  const codigo = ajustes ? codigoInsercion(web, ajustes.clave) : '';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form action={accion} className="min-w-0">
        <SeccionAjuste titulo="Estado" descripcion="Mientras esté desactivado, el globo no aparece en tu web.">
          <Interruptor name="activo" defaultChecked={a.activo} disabled={off} etiqueta="Chat web activado"
            descripcion="Los mensajes entran en Conversaciones con el canal «Chat web» y avisan a quien lleve el contacto." />
        </SeccionAjuste>

        <SeccionAjuste titulo="Apariencia" descripcion="Cómo se ve el globo y la ventana del chat.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Título</span>
              <input name="titulo" required maxLength={60} defaultValue={a.titulo} onChange={poner('titulo')} disabled={off} className={estiloInput} /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Subtítulo</span>
              <input name="subtitulo" maxLength={120} defaultValue={a.subtitulo} onChange={poner('subtitulo')} disabled={off} className={estiloInput} /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Mensaje de bienvenida</span>
              <textarea name="saludo" rows={2} maxLength={300} defaultValue={a.saludo} onChange={poner('saludo')} disabled={off} className={estiloArea} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Color</span>
              <span className="flex items-center gap-2">
                <input type="color" name="color" defaultValue={a.color} onChange={poner('color')} disabled={off} aria-label="Color"
                  className="h-10 w-14 cursor-pointer rounded border border-borde-fuerte bg-superficie p-1" />
                <span className="font-mono text-sm text-tenue">{vista.color}</span>
              </span></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Posición</span>
              <select name="posicion" defaultValue={a.posicion} onChange={poner('posicion')} disabled={off} className={estiloInput}>
                <option value="derecha">Abajo a la derecha</option>
                <option value="izquierda">Abajo a la izquierda</option>
              </select></label>
          </div>
        </SeccionAjuste>

        <SeccionAjuste titulo="Datos del visitante" descripcion="Antes de escribir se le pide nombre y correo para poder responderle aunque cierre la web.">
          <div className="space-y-4">
            <Interruptor name="pedir_telefono" defaultChecked={a.pedir_telefono} disabled={off} etiqueta="Pedir también el teléfono (obligatorio)" />
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Aviso legal (opcional)</span>
              <textarea name="aviso_legal" rows={2} maxLength={400} defaultValue={a.aviso_legal} disabled={off}
                placeholder="Ej. Al enviar aceptas nuestra política de privacidad: tuweb.com/privacidad" className={estiloArea} /></label>
          </div>
        </SeccionAjuste>

        <SeccionAjuste titulo="Webs autorizadas" descripcion="Si pones dominios, el chat solo funciona en esas webs (y sus subdominios). Vacío = cualquier web.">
          <textarea name="dominios" rows={2} defaultValue={a.dominios.join(', ')} disabled={off} placeholder="tuweb.com, tienda.tuweb.com" className={estiloArea} />
        </SeccionAjuste>

        {soyAdmin && (
          <div className="flex flex-wrap items-center justify-end gap-3 py-4">
            <Aviso estado={estado} />
            <BotonEnvio>Guardar</BotonEnvio>
          </div>
        )}
      </form>

      <aside className="min-w-0 space-y-6">
        <section className="rounded-lg border border-borde bg-superficie p-5">
          <h2 className="text-sm font-medium text-texto">Código para tu web</h2>
          {ajustes ? (
            <>
              <p className="mt-1 text-sm text-tenue">Pégalo antes de <code className="rounded bg-superficie-2 px-1">&lt;/body&gt;</code> en todas las páginas (o en el pie de tu WordPress, Wix…).</p>
              <div className="mt-3 flex items-start gap-1 rounded-md border border-borde bg-superficie-2 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-texto-2">{codigo}</code>
                <BotonCopiar texto={codigo} etiqueta="Copiar código" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`${web}/chat/${ajustes.clave}`} target="_blank" rel="noopener noreferrer" className={`${estilosBoton.secundario} inline-flex items-center gap-1.5`}>
                  <ExternalLink className="size-4" /> Probar el chat
                </a>
                {soyAdmin && (
                  <button type="button" disabled={pendiente} className={`${estilosBoton.secundario} inline-flex items-center gap-1.5`}
                    onClick={() => confirm('El código actual dejará de funcionar y tendrás que pegar el nuevo en tu web. ¿Seguir?') &&
                      iniciar(async () => setAviso(await renovarClaveChat(subId)))}>
                    <RefreshCw className="size-4" /> Renovar código
                  </button>
                )}
              </div>
              {aviso && <div className="mt-3"><Aviso estado={aviso} /></div>}
              {!a.activo && <p className="mt-3 text-xs text-aviso">El chat está desactivado: actívalo y guarda para que aparezca.</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-tenue">Guarda los ajustes para obtener el código.</p>
          )}
        </section>

        <section aria-label="Vista previa">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-tenue">Vista previa</p>
          <div className="relative h-[460px] overflow-hidden rounded-lg border border-borde bg-[repeating-linear-gradient(135deg,#f2f4f7,#f2f4f7_10px,#eaecf0_10px,#eaecf0_20px)] dark:bg-[repeating-linear-gradient(135deg,#1f2937,#1f2937_10px,#111827_10px,#111827_20px)]">
            <div className={`absolute bottom-[84px] ${vista.posicion === 'izquierda' ? 'left-3' : 'right-3'} w-[260px] overflow-hidden rounded-xl bg-white shadow-xl`}>
              <div className="flex items-start gap-2 px-3 py-2.5 text-white" style={{ background: vista.color }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{vista.titulo || 'Chat'}</p>
                  {vista.subtitulo && <p className="truncate text-[11px] text-white/85">{vista.subtitulo}</p>}
                </div>
                <X className="size-4 opacity-80" />
              </div>
              <div className="space-y-2 bg-[#f9fafb] p-3">
                {vista.saludo && <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#eaecf0] bg-white px-3 py-1.5 text-xs text-[#101828]">{vista.saludo}</p>}
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3 py-1.5 text-xs text-white" style={{ background: vista.color }}>Hola, quería información</p>
              </div>
              <div className="flex items-center gap-2 border-t border-[#eaecf0] p-2">
                <span className="h-8 flex-1 rounded-md border border-[#d0d5dd] px-2 text-[11px] leading-8 text-[#98a2b3]">Escribe un mensaje…</span>
                <span className="flex size-8 items-center justify-center rounded-md text-white" style={{ background: vista.color }}><Send className="size-3.5" /></span>
              </div>
            </div>
            <span className={`absolute bottom-4 ${vista.posicion === 'izquierda' ? 'left-3' : 'right-3'} flex size-14 items-center justify-center rounded-full text-white shadow-lg`}
              style={{ background: vista.color }}>
              <MessageSquare className="size-6" />
            </span>
          </div>
        </section>
      </aside>
    </div>
  );
}
