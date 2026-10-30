'use client';
import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { borrarCampo, guardarCampo } from '@/app/subcuenta/[id]/contactos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo as CampoUI, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput, estiloArea } from '@/components/ui/clases';
import { TIPOS_CAMPO, type Campo } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

export function GestorCampos({ subId, campos, soyAdmin }: { subId: string; campos: Campo[]; soyAdmin: boolean }) {
  const [editar, setEditar] = useState<Campo | 'nuevo' | null>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cerrar = useCallback(() => setEditar(null), []);
  const carpetas = [...new Set(campos.map((c) => c.carpeta))];
  const tipo = (t: string) => TIPOS_CAMPO.find((x) => x.valor === t)?.texto ?? t;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-tenue">Datos extra que quieras guardar en cada contacto. Aparecen en su ficha, como columnas y como filtros.</p>
        {soyAdmin && <button className={estilosBoton.primario} onClick={() => setEditar('nuevo')}><Plus className="size-4" /> Añadir campo</button>}
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      {campos.length === 0 ? (
        <div className="rounded-lg border border-borde bg-superficie px-6 py-12 text-center text-sm text-tenue">Aún no hay campos personalizados.</div>
      ) : (
        carpetas.map((carpeta) => (
          <section key={carpeta} className="mb-5 overflow-hidden rounded-lg border border-borde bg-superficie">
            <h2 className="border-b bg-superficie-2 px-4 py-2.5 text-sm font-semibold">{carpeta}</h2>
            <ul className="divide-y">
              {campos.filter((c) => c.carpeta === carpeta).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.nombre}</span>
                    <span className="text-xs text-tenue">{tipo(c.tipo)} · clave <code>{c.clave}</code>{c.opciones.length > 0 && ` · ${c.opciones.join(', ')}`}</span>
                  </span>
                  {soyAdmin && (
                    <>
                      <button onClick={() => setEditar(c)} aria-label={`Editar ${c.nombre}`} className="rounded p-1.5 text-tenue hover:text-texto"><Pencil className="size-4" /></button>
                      <button disabled={pendiente} aria-label={`Borrar ${c.nombre}`} className="rounded p-1.5 text-tenue hover:text-peligro"
                        onClick={() => confirm(`¿Borrar el campo «${c.nombre}»? Se eliminará su valor en todos los contactos.`) &&
                          iniciar(async () => setAviso(await borrarCampo(subId, c.id)))}>
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <Modal abierto={editar !== null} alCerrar={cerrar} titulo={editar === 'nuevo' ? 'Nuevo campo' : 'Editar campo'}>
        {editar !== null && <FormularioCampo subId={subId} campo={editar === 'nuevo' ? undefined : editar} carpetas={carpetas} alGuardar={cerrar} />}
      </Modal>
    </div>
  );
}

function FormularioCampo({ subId, campo, carpetas, alGuardar }: { subId: string; campo?: Campo; carpetas: string[]; alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarCampo.bind(null, subId, campo?.id ?? null), null);
  const [tipo, setTipo] = useState(campo?.tipo ?? 'texto');
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado, alGuardar]);
  return (
    <form action={accion} className="space-y-4">
      <CampoUI etiqueta="Nombre del campo" name="nombre" defaultValue={campo?.nombre} required maxLength={80} />
      <Selector etiqueta="Tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as never)} opciones={TIPOS_CAMPO}
        disabled={Boolean(campo)} />
      {campo && <input type="hidden" name="tipo" value={tipo} />}
      {campo && <p className="-mt-2 text-xs text-tenue">El tipo no se cambia una vez creado, para no romper los valores guardados.</p>}
      {(tipo === 'lista' || tipo === 'casillas') && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Opciones (una por línea)</span>
          <textarea name="opciones" rows={5} defaultValue={campo?.opciones.join('\n')} className={estiloArea} required />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Carpeta</span>
        <input name="carpeta" list="carpetas" defaultValue={campo?.carpeta ?? 'Información adicional'} maxLength={60} className={estiloInput} />
        <datalist id="carpetas">{carpetas.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
