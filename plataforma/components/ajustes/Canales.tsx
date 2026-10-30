'use client';
import { useActionState, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, PlugZap } from 'lucide-react';
import { comprobarCanal, guardarCorreo, guardarTwilio } from '@/app/subcuenta/[id]/configuracion/acciones-canales';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import type { Ajustes } from '@/lib/conversaciones/tipos';
import type { Resultado } from '@/lib/tipos';
import { SeccionAjuste } from './Piezas';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';
const ayuda = 'mt-1 block text-xs text-tenue';

function Secreto({ name, texto, puesto, nota, deshabilitado }: { name: string; texto: string; puesto: boolean; nota?: string; deshabilitado: boolean }) {
  return (
    <label className="block">
      <span className={etiqueta}>{texto}</span>
      <input type="password" name={name} autoComplete="new-password" disabled={deshabilitado} maxLength={500}
        placeholder={puesto ? '•••••••• guardada (escribe para cambiarla)' : 'Sin configurar'} className={estiloInput} />
      {puesto && <span className="mt-1 flex items-center gap-1 text-xs text-[#067647]"><CheckCircle2 className="size-3.5" /> Guardada en el servidor: nadie del equipo puede leerla ni se vuelve a mostrar.</span>}
      {nota && <span className={ayuda}>{nota}</span>}
    </label>
  );
}

function Comprobar({ subId, que }: { subId: string; que: 'twilio' | 'correo' }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pendiente} onClick={() => iniciar(async () => setR(await comprobarCanal(subId, que)))} className={estilosBoton.secundario}>
        {pendiente ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Comprobar conexión
      </button>
      <Aviso estado={r} />
    </div>
  );
}

function UrlWebhook({ url, texto }: { url: string; texto: string }) {
  return (
    <div>
      <span className={etiqueta}>{texto}</span>
      <div className="flex items-center gap-1">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${estiloInput} font-mono text-xs`} />
        <BotonCopiar texto={url} etiqueta="Copiar URL" />
      </div>
    </div>
  );
}

export function AjustesTwilio({ subId, ajustes: a, tokenPuesto, soyAdmin, web }: { subId: string; ajustes: Ajustes; tokenPuesto: boolean; soyAdmin: boolean; web: string }) {
  const [estado, accion] = useActionState(guardarTwilio.bind(null, subId), null);
  const off = !soyAdmin;
  return (
    <>
      <SeccionAjuste titulo="Cuenta de Twilio" descripcion="SMS y WhatsApp salen y entran por tu propia cuenta de Twilio. Los datos están en la portada de console.twilio.com.">
        <form action={accion} className="space-y-4">
          <label className="block">
            <span className={etiqueta}>Account SID</span>
            <input name="twilio_sid" defaultValue={a.twilio_sid} disabled={off} placeholder="AC…" maxLength={34} className={`${estiloInput} font-mono`} />
          </label>
          <Secreto name="twilio_token" texto="Auth Token" puesto={tokenPuesto} deshabilitado={off} />
          {tokenPuesto && soyAdmin && (
            <label className="flex items-center gap-2 text-sm text-tenue"><input type="checkbox" name="borrar_token" className="size-4" /> Borrar el token guardado</label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={etiqueta}>Número para SMS</span>
              <input name="twilio_numero_sms" defaultValue={a.twilio_numero_sms} disabled={off} placeholder="+34 600 000 000" className={estiloInput} />
            </label>
            <label className="block">
              <span className={etiqueta}>Número de WhatsApp</span>
              <input name="twilio_numero_wa" defaultValue={a.twilio_numero_wa} disabled={off} placeholder="+34 600 000 000" className={estiloInput} />
              <span className={ayuda}>El remitente de WhatsApp aprobado en Twilio. Vacío = el mismo de SMS.</span>
            </label>
          </div>
          <Aviso estado={estado} />
          {soyAdmin && <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>}
        </form>
      </SeccionAjuste>
      <SeccionAjuste titulo="Mensajes entrantes" descripcion="Pega esta URL en Twilio para recibir respuestas: Phone Numbers → tu número → Messaging → «A message comes in» (HTTP POST). En WhatsApp, en la configuración del remitente.">
        <div className="space-y-4">
          <UrlWebhook url={`${web}/api/webhooks/twilio/${subId}`} texto="URL del webhook" />
          <p className="text-xs text-tenue">Cada petición se comprueba con la firma de Twilio (X-Twilio-Signature) usando tu Auth Token: las peticiones falsas se rechazan. La misma URL recibe el estado de entrega de los mensajes enviados.</p>
          {soyAdmin && <Comprobar subId={subId} que="twilio" />}
        </div>
      </SeccionAjuste>
    </>
  );
}

export function AjustesCorreo({ subId, ajustes: a, puestos, soyAdmin, web }: {
  subId: string; ajustes: Ajustes; puestos: { mailgun_clave: boolean; mailgun_firma: boolean; smtp_clave: boolean }; soyAdmin: boolean; web: string;
}) {
  const [estado, accion] = useActionState(guardarCorreo.bind(null, subId), null);
  const [proveedor, setProveedor] = useState(a.correo_proveedor);
  const off = !soyAdmin;
  return (
    <form action={accion}>
      <SeccionAjuste titulo="Remitente" descripcion="Nombre y dirección con los que llegan tus correos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={etiqueta}>Nombre del remitente</span>
            <input name="correo_nombre" defaultValue={a.correo_nombre} disabled={off} maxLength={120} placeholder="Clínica Norte" className={estiloInput} />
          </label>
          <label className="block">
            <span className={etiqueta}>Correo del remitente</span>
            <input name="correo_remitente" type="email" defaultValue={a.correo_remitente} disabled={off} placeholder="hola@tudominio.com" className={estiloInput} />
          </label>
        </div>
      </SeccionAjuste>
      <SeccionAjuste titulo="Proveedor de envío" descripcion="Mailgun permite además recibir las respuestas en la bandeja. Con SMTP (Gmail, Outlook, tu hosting…) solo se envía.">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {([['', 'Desactivado'], ['mailgun', 'Mailgun'], ['smtp', 'SMTP']] as const).map(([v, t]) => (
              <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${proveedor === v ? 'border-primario bg-primario-suave font-medium text-primario-texto' : 'border-borde-fuerte'}`}>
                <input type="radio" name="correo_proveedor" value={v} checked={proveedor === v} disabled={off} onChange={() => setProveedor(v)} className="size-4 accent-primario" />{t}
              </label>
            ))}
          </div>
          {proveedor === 'mailgun' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <label className="block">
                  <span className={etiqueta}>Dominio de envío</span>
                  <input name="mailgun_dominio" defaultValue={a.mailgun_dominio} disabled={off} placeholder="mg.tudominio.com" className={estiloInput} />
                </label>
                <label className="block">
                  <span className={etiqueta}>Región</span>
                  <select name="mailgun_region" defaultValue={a.mailgun_region} disabled={off} className={estiloInput}>
                    <option value="eu">Europa (EU)</option>
                    <option value="us">Estados Unidos (US)</option>
                  </select>
                </label>
              </div>
              <Secreto name="mailgun_clave" texto="Clave de API privada" puesto={puestos.mailgun_clave} deshabilitado={off} />
              <Secreto name="mailgun_firma" texto="HTTP webhook signing key" puesto={puestos.mailgun_firma} deshabilitado={off}
                nota="Mailgun → Sending → Webhooks. Sirve para comprobar que los correos entrantes vienen de verdad de Mailgun." />
              <UrlWebhook url={`${web}/api/webhooks/mailgun/${subId}`} texto="URL para recibir correos" />
              <p className="text-xs text-tenue">En Mailgun → Receiving → Create route: expresión «match_recipient(&quot;{a.correo_remitente || 'hola@tudominio.com'}&quot;)» y acción «forward» a esta URL.</p>
            </div>
          )}
          {proveedor === 'smtp' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <label className="block">
                  <span className={etiqueta}>Servidor SMTP</span>
                  <input name="smtp_host" defaultValue={a.smtp_host} disabled={off} placeholder="smtp.gmail.com" className={estiloInput} />
                </label>
                <label className="block">
                  <span className={etiqueta}>Puerto</span>
                  <input name="smtp_puerto" type="number" defaultValue={a.smtp_puerto} disabled={off} min={1} max={65535} className={estiloInput} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#344054] dark:text-texto-2">
                <input type="checkbox" name="smtp_seguro" defaultChecked={a.smtp_seguro} disabled={off} className="size-4" /> Conexión SSL/TLS directa (puerto 465)
              </label>
              <label className="block">
                <span className={etiqueta}>Usuario</span>
                <input name="smtp_usuario" defaultValue={a.smtp_usuario} disabled={off} autoComplete="off" className={estiloInput} />
              </label>
              <Secreto name="smtp_clave" texto="Contraseña" puesto={puestos.smtp_clave} deshabilitado={off} nota="En Gmail, usa una «contraseña de aplicación», no la de tu cuenta." />
            </div>
          )}
          {/* Los campos del proveedor no elegido se envían con su valor actual para no perderlos. */}
          {proveedor !== 'mailgun' && <><input type="hidden" name="mailgun_dominio" value={a.mailgun_dominio} /><input type="hidden" name="mailgun_region" value={a.mailgun_region} /></>}
          {proveedor !== 'smtp' && <><input type="hidden" name="smtp_host" value={a.smtp_host} /><input type="hidden" name="smtp_puerto" value={a.smtp_puerto} />
            <input type="hidden" name="smtp_usuario" value={a.smtp_usuario} />{a.smtp_seguro && <input type="hidden" name="smtp_seguro" value="on" />}</>}
          <Aviso estado={estado} />
          {soyAdmin && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Comprobar subId={subId} que="correo" />
              <BotonEnvio>Guardar</BotonEnvio>
            </div>
          )}
        </div>
      </SeccionAjuste>
    </form>
  );
}
