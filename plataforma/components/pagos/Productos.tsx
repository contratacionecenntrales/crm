'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { borrarProducto, guardarProducto } from '@/app/subcuenta/[id]/pagos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import type { Producto } from '@/lib/pagos/tipos';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

function Formulario({ subId, p, impuesto, alGuardar }: { subId: string; p: Producto | null; impuesto: number; alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarProducto.bind(null, subId, p?.id ?? null), null);
  useEffect(() => { if (estado?.ok) alGuardar(); }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render
  return (
    <form action={accion} className="space-y-4">
      <label className="block"><span className={etiqueta}>Nombre</span><input name="nombre" required maxLength={200} defaultValue={p?.nombre} className={estiloInput} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block"><span className={etiqueta}>Precio (sin impuestos)</span><input name="precio" inputMode="decimal" required defaultValue={p?.precio ?? ''} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Impuesto %</span><input name="impuesto" inputMode="decimal" defaultValue={p?.impuesto ?? impuesto} className={estiloInput} /></label>
      </div>
      <label className="block"><span className={etiqueta}>Descripción</span><textarea name="descripcion" rows={3} maxLength={2000} defaultValue={p?.descripcion} className={estiloArea} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="hidden" name="activo" value="off" />
        <input type="checkbox" name="activo" value="on" defaultChecked={p?.activo ?? true} className="size-4" /> Disponible al facturar</label>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}

export function GestorProductos({ subId, productos, moneda, impuesto }: { subId: string; productos: Producto[]; moneda: string; impuesto: number }) {
  const [editar, setEditar] = useState<Producto | null | undefined>(undefined);
  const [pendiente, iniciar] = useTransition();
  const din = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda }).format(n);
  return (
    <div className="rounded-lg border border-borde-fuerte bg-superficie">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-texto">{productos.length} productos</span>
        <button type="button" onClick={() => setEditar(null)} className={estilosBoton.primario}><Plus className="size-4" /> Nuevo producto</button>
      </div>
      <table className={`w-full text-left text-[13px] text-[#475467] dark:text-texto-2 ${pendiente ? 'opacity-60' : ''}`}>
        <thead className="bg-superficie-2 text-xs"><tr><th className="px-4 py-2.5 font-medium">Nombre</th><th className="px-4 py-2.5 font-medium">Precio</th><th className="px-4 py-2.5 font-medium">Impuesto</th><th className="px-4 py-2.5 font-medium">Estado</th><th /></tr></thead>
        <tbody>
          {productos.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-tenue">Todavía no hay productos. Créalos para facturar con un clic.</td></tr>}
          {productos.map((p) => (
            <tr key={p.id} className="border-t border-borde-fuerte">
              <td className="px-4 py-2.5"><span className="font-medium text-texto">{p.nombre}</span>{p.descripcion && <span className="block truncate text-xs text-tenue">{p.descripcion}</span>}</td>
              <td className="px-4 py-2.5">{din(Number(p.precio))}</td>
              <td className="px-4 py-2.5">{Number(p.impuesto)} %</td>
              <td className="px-4 py-2.5">{p.activo ? 'Disponible' : <span className="text-tenue">Oculto</span>}</td>
              <td className="px-4 py-2.5 text-right">
                <button type="button" aria-label="Editar" onClick={() => setEditar(p)} className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto"><Pencil className="size-4" /></button>
                <button type="button" aria-label="Borrar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"
                  onClick={() => confirm(`¿Borrar «${p.nombre}»? Las facturas ya hechas no cambian.`) && iniciar(async () => { const r = await borrarProducto(subId, p.id); if (!r.ok) alert(r.error); })}>
                  <Trash2 className="size-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal abierto={editar !== undefined} alCerrar={() => setEditar(undefined)} titulo={editar ? 'Editar producto' : 'Nuevo producto'} ancho="max-w-md">
        {editar !== undefined && <Formulario key={editar?.id ?? 'nuevo'} subId={subId} p={editar} impuesto={impuesto} alGuardar={() => setEditar(undefined)} />}
      </Modal>
    </div>
  );
}
