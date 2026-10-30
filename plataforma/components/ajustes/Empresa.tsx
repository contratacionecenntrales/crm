'use client';
import { useActionState, useRef, useState, useTransition } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import {
  guardarBasicos, guardarCss, guardarDominios, guardarExpiracion, guardarLogo, guardarPoliticas, guardarTema,
} from '@/app/agencia/configuracion/acciones';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloArea, estiloInput } from '@/components/ui/clases';
import { MONEDAS, PAISES, ZONAS_HORARIAS } from '@/lib/opciones';
import { SeccionAjuste } from './Piezas';
import type { Agencia, Resultado } from '@/lib/tipos';

const CATEGORIAS = ['Agencia de marketing', 'Consultoría', 'Desarrollo de software', 'Comercio', 'Salud y bienestar', 'Inmobiliaria', 'Educación', 'Otro']
  .map((x) => ({ valor: x, texto: x }));

function Botones() {
  return (
    <div className="flex justify-end gap-2">
      <button type="reset" className={estilosBoton.secundario}>Cancelar</button>
      <BotonEnvio>Guardar cambios</BotonEnvio>
    </div>
  );
}

export function Basicos({ agencia: a }: { agencia: Agencia }) {
  const [estado, accion] = useActionState(guardarBasicos, null);
  return (
    <form action={accion}>
      <SeccionAjuste titulo="Información de la empresa" descripcion="Actualizar información básica de la empresa">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo className="sm:col-span-2" etiqueta="Nombre de la empresa *" name="nombre" defaultValue={a.nombre} required minLength={2} maxLength={120} />
          <Campo className="sm:col-span-2" etiqueta="Correo electrónico de la empresa *" name="email" type="email" defaultValue={a.email ?? ''} required />
          <Campo className="sm:col-span-2" etiqueta="Teléfono de la empresa" name="telefono" type="tel" defaultValue={a.telefono} />
          <Campo className="sm:col-span-2" etiqueta="Sitio web de la empresa" name="web" type="url" placeholder="https://" defaultValue={a.web} />
          <Selector etiqueta="Categoría de negocio *" name="categoria" defaultValue={a.categoria || 'Agencia de marketing'} opciones={CATEGORIAS} />
          <Campo etiqueta="Nicho de negocio *" name="nicho" defaultValue={a.nicho} required maxLength={80} />
          <Campo className="sm:col-span-2" etiqueta="¿Para qué utiliza principalmente la plataforma?" name="uso_principal" defaultValue={a.uso_principal} maxLength={200} />
          <Selector etiqueta="Moneda" name="moneda" defaultValue={a.moneda} opciones={MONEDAS} />
        </div>
      </SeccionAjuste>
      <SeccionAjuste titulo="Dirección de la empresa" descripcion="Actualizar la dirección de la empresa">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo className="sm:col-span-2" etiqueta="Dirección *" name="direccion" defaultValue={a.direccion} required maxLength={200} />
          <Campo etiqueta="Ciudad *" name="ciudad" defaultValue={a.ciudad} required maxLength={100} />
          <Campo etiqueta="Código postal *" name="codigo_postal" defaultValue={a.codigo_postal} required maxLength={12} />
          <Campo etiqueta="Estado / provincia / Región *" name="provincia" defaultValue={a.provincia} required maxLength={100} />
          <Selector etiqueta="País *" name="pais" defaultValue={a.pais || 'ES'} opciones={PAISES} />
          <Selector className="sm:col-span-2" etiqueta="Zona horaria *" name="zona_horaria" defaultValue={a.zona_horaria} opciones={ZONAS_HORARIAS} />
          <div className="sm:col-span-2"><Aviso estado={estado} /></div>
          <div className="sm:col-span-2"><Botones /></div>
        </div>
      </SeccionAjuste>
    </form>
  );
}

export function MarcaBlanca({ agencia: a }: { agencia: Agencia }) {
  const [logo, setLogo] = useState(a.logo_url);
  const [avisoLogo, setAvisoLogo] = useState<Resultado | null>(null);
  const [subiendo, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const [eDom, accDom] = useActionState(guardarDominios, null);
  const [ePol, accPol] = useActionState(guardarPoliticas, null);
  const [eCss, accCss] = useActionState(guardarCss, null);
  const [tema, setTema] = useState(a.tema_defecto);
  const [avisoTema, setAvisoTema] = useState<Resultado | null>(null);

  const subir = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2.5 * 1024 * 1024) return setAvisoLogo({ ok: false, error: 'El logo no puede pasar de 2,5 MB.' });
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(f.type)) return setAvisoLogo({ ok: false, error: 'Usa PNG, JPG, WEBP o SVG.' });
    iniciar(async () => {
      const supabase = crearClienteNavegador();
      const ext = f.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const ruta = `${a.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('marcas').upload(ruta, f, { upsert: false, contentType: f.type, cacheControl: '3600' });
      if (error) return setAvisoLogo({ ok: false, error: `No se pudo subir: ${error.message}` });
      const url = supabase.storage.from('marcas').getPublicUrl(ruta).data.publicUrl;
      const r = await guardarLogo(url);
      setAvisoLogo(r);
      if (r.ok) setLogo(url);
    });
  };

  return (
    <>
      <SeccionAjuste titulo="Logotipo" descripcion="Actualizar el logotipo de la marca">
        <div className="flex flex-wrap items-center gap-6"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); subir(e.dataTransfer.files[0]); }}>
          <div className="flex h-28 w-56 items-center justify-center rounded-lg border border-borde bg-superficie-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="Logo actual" className="max-h-full max-w-full object-contain" /> : <ImageUp className="size-8 text-tenue" />}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-texto">Arrastre un archivo a esta zona para subirlo</p>
            <p className="text-xs text-tenue">El tamaño propuesto es de 350 × 180 px. No más de 2,5 MB</p>
            <div className="flex gap-2">
              <button type="button" disabled={subiendo} onClick={() => entrada.current?.click()} className={estilosBoton.secundario}>{logo ? 'Reemplazar' : 'Subir logo'}</button>
              {logo && (
                <button type="button" disabled={subiendo} aria-label="Quitar logo" className="inline-flex size-9 items-center justify-center rounded-lg bg-[#9b1c1c] text-white"
                  onClick={() => iniciar(async () => { const r = await guardarLogo(null); setAvisoLogo(r); if (r.ok) setLogo(null); })}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => subir(e.target.files?.[0])} />
          </div>
        </div>
        <div className="mt-3"><Aviso estado={avisoLogo} /></div>
      </SeccionAjuste>

      <SeccionAjuste titulo="Dominios" descripcion="Actualice sus dominios y URLs">
        <form action={accDom} className="space-y-4">
          <Campo etiqueta="White-Label dominio" name="dominio_marca" defaultValue={a.dominio_marca} placeholder="Por favor, introduzca su dominio de marca blanca (ej. app.tuagencia.com)" />
          <Campo etiqueta="Dominio de API" name="dominio_api" defaultValue={a.dominio_api} placeholder="Introduzca su dominio API" />
          <p className="text-xs text-tenue">Crea en tu DNS un registro CNAME de cada dominio hacia el dominio de la plataforma y añádelo también en Vercel → Domains.</p>
          <Aviso estado={eDom} />
          <Botones />
        </form>
      </SeccionAjuste>

      <SeccionAjuste titulo="Políticas" descripcion="Actualice las URL de sus políticas de privacidad y términos y condiciones">
        <form action={accPol} className="space-y-4">
          <Campo etiqueta="URL de la política de privacidad" name="url_privacidad" type="url" defaultValue={a.url_privacidad} placeholder="Introduzca la URL de su política de privacidad" />
          <Campo etiqueta="URL de los términos y condiciones" name="url_terminos" type="url" defaultValue={a.url_terminos} placeholder="Introduzca la URL de sus términos y condiciones" />
          <Aviso estado={ePol} />
          <Botones />
        </form>
      </SeccionAjuste>

      <SeccionAjuste titulo="CSS personalizado" descripcion="Personalice la plataforma con CSS">
        <form action={accCss} className="space-y-4">
          <textarea name="css" defaultValue={a.css_personalizado} rows={12} spellCheck={false} maxLength={20000}
            placeholder={':root {\n  --color-primario: #4273ea;\n}'} className={`${estiloArea} font-mono text-[13px] leading-5`} />
          <p className="text-xs text-tenue">Se aplica a la agencia y a todas sus subcuentas. Puedes cambiar los colores con las variables --fondo, --superficie, --texto o --color-primario.</p>
          <Aviso estado={eCss} />
          <Botones />
        </form>
      </SeccionAjuste>

      <SeccionAjuste titulo="Tema" descripcion="Seleccionar un tema por defecto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['claro', 'oscuro'] as const).map((t) => (
            <label key={t} className={`cursor-pointer rounded-lg border-2 p-3 ${tema === t ? 'border-primario' : 'border-borde'}`}>
              <span className="mb-2 flex items-center gap-2 text-sm">
                <input type="radio" name="tema" checked={tema === t} className="accent-[var(--color-primario)]"
                  onChange={() => { setTema(t); void guardarTema(t).then(setAvisoTema); }} />
                {t === 'claro' ? 'Tema claro' : 'Tema Oscuro'}
              </span>
              <span className={`flex h-24 overflow-hidden rounded border ${t === 'claro' ? 'bg-white' : 'bg-gray-900'}`} aria-hidden>
                <span className={`w-1/4 ${t === 'claro' ? 'bg-gray-100' : 'bg-gray-800'}`} />
                <span className="flex-1 p-2"><span className={`block h-2 w-1/2 rounded ${t === 'claro' ? 'bg-gray-200' : 'bg-gray-700'}`} /></span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-tenue">Es el tema inicial de cada usuario; cada uno puede cambiarlo en su menú.</p>
        <div className="mt-2"><Aviso estado={avisoTema} /></div>
      </SeccionAjuste>
    </>
  );
}

const TIEMPOS = [
  [null, 'Nunca'], [15, '15 minutos'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [480, '8 horas'], [1440, '1 día'], [10080, '7 días'],
] as const;

export function Avanzada({ agencia: a }: { agencia: Agencia }) {
  const [valor, setValor] = useState<string>(a.expiracion_sesion_min === null ? '' : String(a.expiracion_sesion_min));
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <SeccionAjuste titulo="Interrupción de la sesión" descripcion="Configurar el tiempo de espera de la sesión">
      <p className="mb-3 text-sm text-texto">La sesión se terminará y el usuario será desconectado automáticamente si está inactivo durante el tiempo seleccionado.</p>
      <select value={valor} disabled={pendiente} aria-label="Tiempo de espera"
        onChange={(e) => {
          setValor(e.target.value);
          iniciar(async () => setAviso(await guardarExpiracion(e.target.value ? Number(e.target.value) : null)));
        }}
        className={`${estiloInput} max-w-60`}>
        {TIEMPOS.map(([v, t]) => <option key={t} value={v ?? ''}>{t}</option>)}
      </select>
      <div className="mt-3"><Aviso estado={aviso} /></div>
    </SeccionAjuste>
  );
}
