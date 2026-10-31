'use client';
import { useActionState, useState } from 'react';
import { guardarSso } from '@/app/agencia/configuracion/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea } from '@/components/ui/clases';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import type { Agencia } from '@/lib/tipos';
import { Interruptor, SeccionAjuste } from './Piezas';

const PROVEEDORES = [
  ['saml', 'SAML 2.0', 'Okta, Azure AD / Entra ID, Google Workspace, OneLogin, JumpCloud…'],
  ['google', 'Google', 'Cuentas de Google Workspace del dominio.'],
  ['azure', 'Microsoft', 'Cuentas de Microsoft 365 / Entra ID.'],
] as const;

function Dato({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-tenue">{texto}</span>
      <div className="flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate rounded border border-borde bg-superficie-2 px-2 py-1.5 text-xs">{valor}</code>
        <BotonCopiar texto={valor} etiqueta="Copiar" />
      </div>
    </div>
  );
}

export function AjustesSso({ agencia: a, dominios, supabase, web }: { agencia: Agencia; dominios: string[]; supabase: string; web: string }) {
  const [estado, accion] = useActionState(guardarSso, null);
  const [proveedor, setProveedor] = useState(a.sso_proveedor ?? 'saml');
  const [activo, setActivo] = useState(Boolean(a.sso_activo));
  const ref = supabase.replace(/^https?:\/\//, '').split('.')[0];
  const primero = dominios[0] ?? 'tuempresa.com';
  return (
    <form action={accion}>
      <SeccionAjuste titulo="Estado" descripcion="Con el SSO, tu equipo entra con la cuenta de su empresa en lugar de con contraseña.">
        <div className="space-y-4">
          <Interruptor name="sso_activo" checked={activo} onChange={setActivo} etiqueta="Inicio de sesión único activado"
            descripcion="En la pantalla de acceso aparecerá «Continuar con SSO» para los correos de tus dominios." />
          <Interruptor name="sso_obligatorio" defaultChecked={a.sso_obligatorio} etiqueta="Obligatorio para estos dominios"
            descripcion="Nadie con un correo de tus dominios podrá entrar con contraseña. Requiere activar el hook (ver abajo)." />
          <Interruptor name="sso_autoalta" defaultChecked={a.sso_autoalta} etiqueta="Alta automática"
            descripcion="La primera vez que alguien de tus dominios entra por SSO, se le añade a la agencia como usuario." />
        </div>
      </SeccionAjuste>
      <SeccionAjuste titulo="Proveedor y dominios" descripcion="Correos de estos dominios usarán el proveedor elegido.">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {PROVEEDORES.map(([v, t, d]) => (
              <label key={v} className={`flex cursor-pointer flex-col rounded-lg border p-3 ${proveedor === v ? 'border-primario bg-primario-suave' : 'border-borde-fuerte'}`}>
                <span className="flex items-center gap-2 text-sm font-medium text-texto">
                  <input type="radio" name="sso_proveedor" value={v} checked={proveedor === v} onChange={() => setProveedor(v)} className="size-4 accent-primario" />{t}
                </span>
                <span className="mt-1 text-xs text-tenue">{d}</span>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">Dominios de correo</span>
            <textarea name="sso_dominios" rows={2} defaultValue={dominios.join(', ')} placeholder="tuempresa.com, tuempresa.es" className={estiloArea} />
            <span className="mt-1 block text-xs text-tenue">Separados por comas. Un dominio solo puede estar en una agencia.</span>
          </label>
        </div>
      </SeccionAjuste>
      <SeccionAjuste titulo="Conexión con el proveedor" descripcion="Pasos que se hacen una vez en Supabase y en tu proveedor de identidad.">
        <div className="space-y-4 text-sm text-[#344054] dark:text-texto-2">
          {proveedor === 'saml' ? (
            <>
              <p>1. En tu proveedor (Okta, Entra ID…) crea una aplicación SAML con estos datos:</p>
              <Dato texto="Entity ID / metadatos del proveedor de servicio" valor={`${supabase}/auth/v1/sso/saml/metadata`} />
              <Dato texto="URL de ACS (Assertion Consumer Service)" valor={`${supabase}/auth/v1/sso/saml/acs`} />
              <p>2. Registra el proveedor en Supabase con la URL de metadatos que te da (requiere el plan Pro de Supabase y su CLI):</p>
              <Dato texto="Comando" valor={`supabase sso add --type saml --project-ref ${ref} --metadata-url "URL_DE_METADATOS" --domains ${dominios.join(',') || primero}`} />
            </>
          ) : (
            <>
              <p>1. En Supabase → Authentication → Providers, activa {proveedor === 'google' ? 'Google' : 'Azure (Microsoft)'} con el ID y el secreto de tu aplicación OAuth.</p>
              <p>2. En la aplicación OAuth de {proveedor === 'google' ? 'Google Cloud' : 'Entra ID'}, añade esta URL de redirección:</p>
              <Dato texto="URL de redirección autorizada" valor={`${supabase}/auth/v1/callback`} />
            </>
          )}
          <p>3. En Supabase → Authentication → URL Configuration, añade a «Redirect URLs»:</p>
          <Dato texto="URL de vuelta" valor={`${web}/auth/confirmar`} />
          <p>4. Para que «Obligatorio» se cumpla siempre, activa en Supabase → Authentication → Hooks → «Customize Access Token (JWT) Claims» la función <code className="rounded bg-superficie-2 px-1">public.sso_hook_token</code>.</p>
        </div>
      </SeccionAjuste>
      <div className="flex items-center justify-end gap-3 pt-2">
        <Aviso estado={estado} />
        <BotonEnvio>Guardar</BotonEnvio>
      </div>
    </form>
  );
}
