'use client';
import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { borrarEmpresa, guardarEmpresa } from '@/app/subcuenta/[id]/contactos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import type { Empresa } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

type Fila = Empresa & { n: number };

export function ListaEmpresas({ subId, empresas, soyAdmin, busqueda }: { subId: string; empresas: Fila[]; soyAdmin: boolean; busqueda: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const [editar, setEditar] = useState<Fila | 'nueva' | null>(null);
  const [texto, setTexto] = useState(busqueda);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cerrar = useCallback(() => setEditar(null), []);
  useEffect(() => {
    if (texto === busqueda) return;
    const t = setTimeout(() => router.push(`${ruta}${texto ? `?q=${encodeURIComponent(texto)}` : ''}`), 350);
    return () => clearTimeout(t);
  }, [texto, busqueda, router, ruta]);

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-xl border bg-superficie shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar empresas" className={`${estiloInput} pl-9`} />
          </label>
          <span className="text-sm text-tenue">{empresas.length} empresas</span>
          <div className="flex-1" />
          <button className={estilosBoton.primario} onClick={() => setEditar('nueva')}><Plus className="size-4" /> Nueva empresa</button>
        </div>
        {aviso && <div className="p-3"><Aviso estado={aviso} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-superficie-2 text-left">
              <tr>{['Empresa', 'Teléfono', 'Correo', 'Web', 'Ciudad', 'Contactos', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {empresas.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">Sin empresas. Se crean solas al poner el nombre de la empresa en un contacto.</td></tr>}
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3"><span className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-tenue" />{e.nombre}</span></td>
                  <td className="px-4 py-3">{e.telefono}</td>
                  <td className="px-4 py-3">{e.email}</td>
                  <td className="max-w-48 truncate px-4 py-3">{e.web && <a href={e.web} target="_blank" rel="noopener noreferrer" className="text-primario hover:underline">{e.web}</a>}</td>
                  <td className="px-4 py-3">{e.ciudad}</td>
                  <td className="px-4 py-3">
                    <a href={`/subcuenta/${subId}/contactos?f=${encodeURIComponent(JSON.stringify([{ campo: 'empresa', op: 'contiene', valor: e.nombre }]))}`} className="text-primario hover:underline">{e.n}</a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button onClick={() => setEditar(e)} aria-label={`Editar ${e.nombre}`} className="rounded p-1.5 text-tenue hover:text-texto"><Pencil className="size-4" /></button>
                    {soyAdmin && (
                      <button disabled={pendiente} aria-label={`Borrar ${e.nombre}`} className="rounded p-1.5 text-tenue hover:text-peligro"
                        onClick={() => confirm(`¿Borrar «${e.nombre}»? Sus contactos se quedan, sin empresa.`) && iniciar(async () => setAviso(await borrarEmpresa(subId, e.id)))}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal abierto={editar !== null} alCerrar={cerrar} titulo={editar === 'nueva' ? 'Nueva empresa' : 'Editar empresa'}>
        {editar !== null && <FormularioEmpresa subId={subId} empresa={editar === 'nueva' ? undefined : editar} alGuardar={cerrar} />}
      </Modal>
    </div>
  );
}

function FormularioEmpresa({ subId, empresa: e, alGuardar }: { subId: string; empresa?: Empresa; alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarEmpresa.bind(null, subId, e?.id ?? null), null);
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado, alGuardar]);
  return (
    <form action={accion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo className="sm:col-span-2" etiqueta="Nombre" name="nombre" defaultValue={e?.nombre} required maxLength={160} />
      <Campo etiqueta="Correo" name="email" type="email" defaultValue={e?.email ?? ''} />
      <Campo etiqueta="Teléfono" name="telefono" defaultValue={e?.telefono} />
      <Campo className="sm:col-span-2" etiqueta="Sitio web" name="web" type="url" placeholder="https://" defaultValue={e?.web} />
      <Campo className="sm:col-span-2" etiqueta="Dirección" name="direccion" defaultValue={e?.direccion} />
      <Campo etiqueta="Ciudad" name="ciudad" defaultValue={e?.ciudad} />
      <Campo etiqueta="País" name="pais" defaultValue={e?.pais} />
      <div className="sm:col-span-2"><Aviso estado={estado} /></div>
      <div className="flex justify-end sm:col-span-2"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
