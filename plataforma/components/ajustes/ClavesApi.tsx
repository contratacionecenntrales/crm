'use client';
import { useActionState, useState, useTransition } from 'react';
import { Ban, KeyRound, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { borrarClaveApi, crearClaveApi, revocarClaveApi } from '@/app/agencia/configuracion/acciones-api';
import { Modal } from '@/components/ui/Modal';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { fechaHora } from '@/lib/formato';
import { PERMISOS, type ClaveApi } from '@/lib/api/permisos';
import type { Resultado } from '@/lib/tipos';

export function GestorClavesApi({ claves, subcuentas, web, zona }: { claves: ClaveApi[]; subcuentas: { id: string; nombre: string }[]; web: string; zona: string }) {
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const nombreSub = (id: string) => subcuentas.find((s) => s.id === id)?.nombre ?? 'Subcuenta';
  const ahora = Date.now();
  const estado = (k: ClaveApi) => k.revocada_en ? ['Revocada', 'rojo'] as const
    : k.caduca && Date.parse(k.caduca) <= ahora ? ['Caducada', 'gris'] as const : ['Activa', 'verde'] as const;
  const sub = subcuentas[0]?.id ?? '<id-subcuenta>';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Claves de API</h1>
          <p className="text-xs text-tenue">Las integraciones privadas te permiten conectar tus propias aplicaciones de forma segura.</p>
        </div>
        {claves.length > 0 && (
          <button onClick={() => setNueva(true)} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Plus className="size-4" /> Crear clave de API</button>
        )}
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}

      {claves.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie px-6 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primario-suave text-primario"><KeyRound className="size-8" /></span>
          <p className="mt-4 font-medium text-texto">No dispone de ninguna clave de API</p>
          <p className="mt-1 max-w-md text-sm text-tenue">Crea una clave para que tus aplicaciones lean y escriban contactos, oportunidades, mensajes y citas de tus subcuentas.</p>
          <button onClick={() => setNueva(true)} className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-md bg-[#16803c] px-4 text-sm font-semibold text-white hover:bg-[#126a32]">
            <Plus className="size-4" /> Crear clave de API
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-borde bg-superficie-2 text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Nombre</th><th className="px-3 py-2.5">Clave</th><th className="px-3 py-2.5">Permisos</th><th className="px-3 py-2.5">Subcuentas</th><th className="px-3 py-2.5">Último uso</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {claves.map((k) => {
                const [txt, tono] = estado(k);
                return (
                  <tr key={k.id}>
                    <td className="px-4 py-2.5"><p className="font-medium text-texto">{k.nombre}</p><p className="text-xs text-tenue">Creada {fechaHora(k.creado, zona)}{k.caduca ? ` · caduca ${fechaHora(k.caduca, zona)}` : ''}</p></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-texto-2">{k.prefijo}…</td>
                    <td className="max-w-60 px-3 py-2.5 text-xs text-texto-2">{k.permisos.map((p) => PERMISOS.find((x) => x.valor === p)?.texto ?? p).join(', ')}</td>
                    <td className="max-w-48 truncate px-3 py-2.5 text-xs text-texto-2">{k.subcuentas.length ? k.subcuentas.map(nombreSub).join(', ') : 'Todas'}</td>
                    <td className="px-3 py-2.5 text-xs text-texto-2">{k.ultimo_uso ? fechaHora(k.ultimo_uso, zona) : 'Nunca'}</td>
                    <td className="px-3 py-2.5"><Insignia tono={tono}>{txt}</Insignia></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {!k.revocada_en && (
                        <button disabled={pendiente} aria-label={`Revocar ${k.nombre}`} title="Revocar" className="rounded p-1.5 text-texto-2 hover:text-peligro"
                          onClick={() => confirm(`¿Revocar «${k.nombre}»? Las aplicaciones que la usen dejarán de funcionar al instante.`) && iniciar(async () => setAviso(await revocarClaveApi(k.id)))}>
                          <Ban className="size-4" />
                        </button>
                      )}
                      <button disabled={pendiente} aria-label={`Borrar ${k.nombre}`} title="Borrar" className="rounded p-1.5 text-texto-2 hover:text-peligro"
                        onClick={() => confirm(`¿Borrar «${k.nombre}» del listado?${k.revocada_en ? '' : ' También deja de funcionar.'}`) && iniciar(async () => setAviso(await borrarClaveApi(k.id)))}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-6 rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-sm font-semibold text-texto">Cómo usar la API</h2>
        <p className="mt-1 text-sm text-tenue">Envía la clave en la cabecera <code className="rounded bg-superficie-2 px-1">Authorization: Bearer mtk_…</code>. Cada ruta trabaja sobre una subcuenta. Máximo 120 peticiones por minuto y clave.</p>
        <ul className="mt-3 grid grid-cols-1 gap-1 font-mono text-xs text-texto-2 md:grid-cols-2">
          {[
            ['GET', 'contactos?q=&email=&limite=&pagina='], ['POST', 'contactos'], ['GET · PATCH · DELETE', 'contactos/{id}'],
            ['GET', 'oportunidades?embudo_id=&estado='], ['POST', 'oportunidades'], ['GET · PATCH', 'oportunidades/{id}'],
            ['POST', 'mensajes'], ['GET', 'calendarios'], ['GET', 'citas?desde=&hasta='],
          ].map(([m, r]) => (
            <li key={m + r} className="truncate"><span className="font-semibold text-primario-texto">{m}</span> /api/v1/subcuentas/{'{sub}'}/{r}</li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-1 rounded-md border border-borde bg-superficie-2 p-3">
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-texto-2">{`curl -X POST ${web}/api/v1/subcuentas/${sub}/contactos \\
  -H "Authorization: Bearer mtk_…" -H "Content-Type: application/json" \\
  -d '{"nombre":"Lucía","email":"lucia@correo.es","telefono":"600111222","etiquetas":["web"]}'`}</pre>
        </div>
      </section>

      <Modal abierto={nueva} alCerrar={() => setNueva(false)} titulo="Crear clave de API">
        {nueva && <FormClave subcuentas={subcuentas} alCerrar={() => setNueva(false)} />}
      </Modal>
    </div>
  );
}

function FormClave({ subcuentas, alCerrar }: { subcuentas: { id: string; nombre: string }[]; alCerrar: () => void }) {
  const [estado, accion] = useActionState(crearClaveApi, null);
  const [todas, setTodas] = useState(true);

  if (estado?.ok && estado.token) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-md bg-[#fffaeb] p-3 text-sm text-[#b54708] dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Copia la clave ahora: por seguridad no se vuelve a mostrar. Si la pierdes, revócala y crea otra.
        </p>
        <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie-2 p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-texto">{estado.token}</code>
          <BotonCopiar texto={estado.token} etiqueta="Copiar clave" />
        </div>
        <div className="flex justify-end"><button onClick={alCerrar} className={estilosBoton.primario}>Hecho</button></div>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre</span>
        <input name="nombre" required maxLength={60} placeholder="Ej. Zapier, web corporativa…" className={estiloInput} /></label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Permisos</legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {PERMISOS.map((p) => (
            <label key={p.valor} className="flex items-center gap-2 text-sm"><input type="checkbox" name="permisos" value={p.valor} defaultChecked={p.valor === 'contactos.leer'} className="size-4" />{p.texto}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Subcuentas</legend>
        <input type="hidden" name="destino" value={todas ? 'todas' : 'algunas'} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(x) => setTodas(x.target.checked)} className="size-4" /> Todas las subcuentas (también las futuras)</label>
        {!todas && (
          <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded border border-borde p-2 sm:grid-cols-2">
            {subcuentas.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="subcuentas" value={s.id} className="size-4" />{s.nombre}</label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Caducidad</span>
        <select name="caduca" defaultValue="365" className={estiloInput}>
          <option value="30">30 días</option><option value="90">90 días</option><option value="365">1 año</option><option value="">Nunca</option>
        </select></label>
      <Aviso estado={estado} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={alCerrar} className={estilosBoton.secundario}>Cancelar</button>
        <BotonEnvio>Crear clave</BotonEnvio>
      </div>
    </form>
  );
}
