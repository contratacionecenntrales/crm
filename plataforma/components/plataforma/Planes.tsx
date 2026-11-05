'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { borrarPlan, guardarPlan } from '@/app/plataforma/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton } from '@/components/ui/clases';
import { dinero } from '@/lib/formato';
import { FUNCIONES } from '@/lib/plataforma';
import type { Resultado } from '@/lib/tipos';

export interface Plan {
  id: string; nombre: string; descripcion: string; precio_mensual: number; moneda: string; max_subcuentas: number | null; max_usuarios: number | null;
  funciones: Record<string, boolean>; activo: boolean; agencias?: number;
}

export function PlanesPlataforma({ planes }: { planes: Plan[] }) {
  const [dialogo, setDialogo] = useState<null | 'nuevo' | Plan>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-texto">Planes</h1><p className="text-xs text-tenue">Lo que puede hacer cada agencia y cuánto paga. Los límites se aplican al momento.</p></div>
        <button onClick={() => setDialogo('nuevo')} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Plus className="size-4" /> Nuevo plan</button>
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {planes.map((p) => (
          <article key={p.id} className={`flex flex-col rounded-lg border bg-superficie p-5 ${p.activo ? 'border-borde' : 'border-dashed border-borde-fuerte opacity-75'}`}>
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="text-lg font-semibold text-texto">{p.nombre}</h2>{!p.activo && <Insignia tono="gris">Inactivo</Insignia>}</div>
              <p className="text-right"><span className="text-2xl font-semibold text-texto">{dinero(p.precio_mensual, p.moneda)}</span><span className="block text-xs text-tenue">por mes</span></p>
            </div>
            {p.descripcion && <p className="mt-2 text-sm text-tenue">{p.descripcion}</p>}
            <ul className="mt-4 space-y-1.5 text-sm text-texto-2">
              <li>{p.max_subcuentas ?? 'Subcuentas ilimitadas'}{p.max_subcuentas !== null && ' subcuenta(s)'}</li>
              <li>{p.max_usuarios ?? 'Usuarios ilimitados'}{p.max_usuarios !== null && ' usuario(s)'}</li>
              {FUNCIONES.map(([k, t]) => (
                <li key={k} className="flex items-center gap-1.5">{p.funciones?.[k] ? <Check className="size-4 text-exito" /> : <X className="size-4 text-tenue" />}{t}</li>
              ))}
            </ul>
            <div className="mt-auto flex items-center justify-between border-t border-borde pt-3 text-xs text-tenue">
              <span>{p.agencias ?? 0} agencia(s)</span>
              <span>
                <button onClick={() => setDialogo(p)} aria-label={`Editar ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>
                <button disabled={pendiente} aria-label={`Borrar ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-peligro"
                  onClick={() => confirm(`¿Borrar el plan «${p.nombre}»?`) && iniciar(async () => setAviso(await borrarPlan(p.id)))}><Trash2 className="size-4" /></button>
              </span>
            </div>
          </article>
        ))}
      </div>
      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nuevo' ? 'Nuevo plan' : 'Editar plan'}>
        {dialogo !== null && <FormPlan p={dialogo === 'nuevo' ? undefined : dialogo} alTerminar={() => setDialogo(null)} />}
      </Modal>
    </div>
  );
}

function FormPlan({ p, alTerminar }: { p?: Plan; alTerminar: () => void }) {
  const [estado, accion] = useActionState(guardarPlan.bind(null, p?.id ?? null), null);
  useEffect(() => { if (estado?.ok) alTerminar(); }, [estado]); // solo al cambiar el resultado
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Nombre" name="nombre" required maxLength={60} defaultValue={p?.nombre} />
      <Campo etiqueta="Descripción" name="descripcion" maxLength={300} defaultValue={p?.descripcion} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Precio al mes" name="precio_mensual" inputMode="decimal" defaultValue={p ? String(p.precio_mensual) : '0'} />
        <Campo etiqueta="Moneda" name="moneda" maxLength={3} defaultValue={p?.moneda ?? 'EUR'} />
        <Campo etiqueta="Máximo de subcuentas" name="max_subcuentas" inputMode="numeric" defaultValue={p?.max_subcuentas?.toString() ?? ''} ayuda="Vacío = sin límite" />
        <Campo etiqueta="Máximo de usuarios" name="max_usuarios" inputMode="numeric" defaultValue={p?.max_usuarios?.toString() ?? ''} ayuda="Vacío = sin límite" />
      </div>
      <fieldset><legend className="mb-1.5 text-sm font-medium">Funciones incluidas</legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {FUNCIONES.map(([k, t]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`f_${k}`} defaultChecked={p ? Boolean(p.funciones?.[k]) : true} className="size-4" />{t}</label>)}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={p?.activo ?? true} className="size-4" /> Disponible para nuevas agencias</label>
      <Aviso estado={estado} />
      <div className="flex justify-end gap-2"><button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
