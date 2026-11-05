'use client';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { actualizarAgenciaPlataforma, crearAgenciaPlataforma } from '@/app/plataforma/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton, estiloArea, estiloInput, estiloInputBase } from '@/components/ui/clases';
import { MONEDAS, ZONAS_HORARIAS } from '@/lib/opciones';
import { dinero, fecha } from '@/lib/formato';

export interface FilaAgenciaPlataforma {
  id: string; nombre: string; estado: 'activa' | 'prueba' | 'suspendida'; prueba_hasta: string | null; plan_id: string | null; plan: string | null;
  precio: number | null; moneda: string; subcuentas: number; usuarios: number; dueno_email: string | null; creado: string; ultimo_acceso: string | null;
  notas: string; motivo: string;
}
type PlanCorto = { id: string; nombre: string; precio_mensual: number; moneda: string; activo: boolean };

const hoy = () => new Date().toISOString().slice(0, 10);
function estadoReal(a: FilaAgenciaPlataforma) {
  if (a.estado === 'prueba' && a.prueba_hasta && a.prueba_hasta < hoy()) return ['Prueba vencida', 'rojo'] as const;
  if (a.estado === 'prueba') return [`Prueba hasta ${fecha(a.prueba_hasta)}`, 'azul'] as const;
  if (a.estado === 'suspendida') return ['Suspendida', 'rojo'] as const;
  return ['Activa', 'verde'] as const;
}

export function AgenciasPlataforma({ agencias, planes }: { agencias: FilaAgenciaPlataforma[]; planes: PlanCorto[] }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('');
  const [dialogo, setDialogo] = useState<null | 'nueva' | FilaAgenciaPlataforma>(null);
  const lista = useMemo(() => agencias.filter((a) =>
    (!q || `${a.nombre} ${a.dueno_email ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!filtro || a.estado === filtro)), [agencias, q, filtro]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Agencias <Insignia>{agencias.length}</Insignia></h1>
          <p className="text-xs text-tenue">Da de alta agencias para tus clientes, asígnales un plan y gestiona su estado.</p>
        </div>
        <button onClick={() => setDialogo('nueva')} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Plus className="size-4" /> Crear agencia</button>
      </div>
      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-borde p-3">
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" className={`${estiloInput} pl-9`} />
          </label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Estado" className={`${estiloInputBase} w-44`}>
            <option value="">Todos los estados</option><option value="activa">Activas</option><option value="prueba">En prueba</option><option value="suspendida">Suspendidas</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Agencia</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Subcuentas</th><th className="px-3 py-2.5">Usuarios</th><th className="px-3 py-2.5">Alta</th><th className="px-3 py-2.5">Última actividad</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-tenue">No hay agencias que coincidan.</td></tr>}
              {lista.map((a) => {
                const [txt, tono] = estadoReal(a);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3"><p className="font-medium text-texto">{a.nombre}</p><p className="text-xs text-tenue">{a.dueno_email ?? 'Sin propietario'}</p></td>
                    <td className="px-3 py-3 text-texto-2">{a.plan ? <>{a.plan}<span className="block text-xs text-tenue">{dinero(a.precio ?? 0, a.moneda)}/mes</span></> : 'Sin plan (sin límites)'}</td>
                    <td className="px-3 py-3"><Insignia tono={tono}>{txt}</Insignia>{a.estado === 'suspendida' && a.motivo && <p className="mt-1 max-w-40 truncate text-xs text-tenue" title={a.motivo}>{a.motivo}</p>}</td>
                    <td className="px-3 py-3 text-texto-2">{a.subcuentas}</td>
                    <td className="px-3 py-3 text-texto-2">{a.usuarios}</td>
                    <td className="px-3 py-3 text-xs text-texto-2">{fecha(a.creado)}</td>
                    <td className="px-3 py-3 text-xs text-texto-2">{a.ultimo_acceso ? fecha(a.ultimo_acceso) : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setDialogo(a)} aria-label={`Gestionar ${a.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nueva' ? 'Crear agencia' : dialogo ? `Gestionar «${dialogo.nombre}»` : ''} ancho="max-w-xl">
        {dialogo === 'nueva' && <FormNueva planes={planes} alTerminar={() => setDialogo(null)} />}
        {dialogo && dialogo !== 'nueva' && <FormGestion a={dialogo} planes={planes} alTerminar={() => setDialogo(null)} />}
      </Modal>
    </div>
  );
}

function FormNueva({ planes, alTerminar }: { planes: PlanCorto[]; alTerminar: () => void }) {
  const [estado, accion] = useActionState(crearAgenciaPlataforma, null);
  useEffect(() => { if (estado?.ok) { const t = setTimeout(alTerminar, 1200); return () => clearTimeout(t); } }, [estado]); // solo al cambiar el resultado
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Nombre de la agencia" name="nombre" required minLength={2} maxLength={120} />
      <Campo etiqueta="Correo del dueño" name="email" type="email" required ayuda="Si aún no tiene cuenta, le llegará una invitación para crear su contraseña." />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Plan</span>
          <select name="plan_id" className={estiloInput} defaultValue={planes.find((p) => p.activo)?.id ?? ''}>
            <option value="">Sin plan (sin límites)</option>
            {planes.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre} · {dinero(p.precio_mensual, p.moneda)}/mes</option>)}
          </select></label>
        <Campo etiqueta="Días de prueba" name="dias_prueba" type="number" min={0} max={365} defaultValue="14" ayuda="0 = activa desde ya." />
        <Selector etiqueta="Moneda" name="moneda" defaultValue="EUR" opciones={MONEDAS} />
        <Selector etiqueta="Zona horaria" name="zona_horaria" defaultValue="Europe/Madrid" opciones={ZONAS_HORARIAS} />
      </div>
      <Aviso estado={estado} />
      <div className="flex justify-end gap-2"><button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button><BotonEnvio>Crear agencia</BotonEnvio></div>
    </form>
  );
}

function FormGestion({ a, planes, alTerminar }: { a: FilaAgenciaPlataforma; planes: PlanCorto[]; alTerminar: () => void }) {
  const [estado, accion] = useActionState(actualizarAgenciaPlataforma.bind(null, a.id), null);
  const [est, setEst] = useState(a.estado);
  useEffect(() => { if (estado?.ok) alTerminar(); }, [estado]); // solo al cambiar el resultado
  return (
    <form action={accion} className="space-y-4">
      <p className="text-sm text-tenue">{a.dueno_email ?? 'Sin propietario'} · {a.subcuentas} subcuenta(s) · {a.usuarios} usuario(s)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Plan</span>
          <select name="plan_id" defaultValue={a.plan_id ?? ''} className={estiloInput}>
            <option value="">Sin plan (sin límites)</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactivo)'}</option>)}
          </select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Estado</span>
          <select name="estado" value={est} onChange={(e) => setEst(e.target.value as never)} className={estiloInput}>
            <option value="activa">Activa</option><option value="prueba">En prueba</option><option value="suspendida">Suspendida</option>
          </select></label>
      </div>
      {est === 'prueba' && <Campo etiqueta="Prueba hasta" name="prueba_hasta" type="date" required defaultValue={a.prueba_hasta ?? ''} />}
      {est === 'suspendida' && <Campo etiqueta="Motivo (lo verá la agencia)" name="motivo" maxLength={300} defaultValue={a.motivo} placeholder="Ej. Pago pendiente" />}
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Notas internas (solo la plataforma)</span>
        <textarea name="notas" rows={3} maxLength={2000} defaultValue={a.notas} className={estiloArea} /></label>
      {est === 'suspendida' && a.estado !== 'suspendida' && <p className="rounded-md bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318] dark:bg-red-950/40 dark:text-red-300">Al suspenderla, ni la agencia ni sus clientes podrán entrar en sus subcuentas, y dejarán de funcionar sus reservas, chat web y API.</p>}
      <Aviso estado={estado} />
      <div className="flex justify-end gap-2"><button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
