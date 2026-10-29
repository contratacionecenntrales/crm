'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  borrarEmbudo, borrarEtapa, crearEmbudo, guardarEtapa, renombrarEmbudo, reordenarEtapas,
} from '@/app/subcuenta/[id]/oportunidades/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import type { Embudo, Etapa } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

const ETAPAS_TIPO = 'Nuevo lead\nContactado\nPropuesta enviada\nNegociación\nCerrado';

export function GestorEmbudos({ subId, embudos, porEtapa, inicial, soyAdmin }: {
  subId: string; embudos: Embudo[]; porEtapa: Record<string, number>; inicial?: string; soyAdmin: boolean;
}) {
  const [elegido, setElegido] = useState<string | undefined>(embudos.find((e) => e.id === inicial)?.id ?? embudos[0]?.id);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [nuevo, setNuevo] = useState(false);
  const [borrando, setBorrando] = useState<Etapa | null>(null);
  const embudo = embudos.find((e) => e.id === elegido) ?? embudos[0];
  const ejecutar = (fn: () => Promise<Resultado>) => iniciar(async () => setAviso(await fn()));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href={`/subcuenta/${subId}/oportunidades${embudo ? `?embudo=${embudo.id}` : ''}`} className="mb-3 inline-flex items-center gap-1 text-sm text-tenue hover:text-texto">
        <ArrowLeft className="size-4" /> Oportunidades
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">Embudos</h1>
        {soyAdmin && <button className={estilosBoton.primario} onClick={() => setNuevo(true)}><Plus className="size-4" /> Crear embudo</button>}
      </div>
      {!soyAdmin && <p className="mb-4 text-sm text-tenue">Solo los administradores de la subcuenta pueden cambiar los embudos.</p>}
      {aviso && !aviso.ok && <div className="mb-3"><Aviso estado={aviso} /></div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
        <ul className="space-y-1">
          {embudos.map((e) => (
            <li key={e.id}>
              <button onClick={() => setElegido(e.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${e.id === embudo?.id ? 'bg-primario-suave font-medium text-primario' : 'hover:bg-superficie-2'}`}>
                {e.nombre}
                <span className="block text-xs text-tenue">{e.etapas.length} etapas · {e.etapas.reduce((s, x) => s + (porEtapa[x.id] ?? 0), 0)} oportunidades</span>
              </button>
            </li>
          ))}
        </ul>

        {embudo && (
          <section className="rounded-xl border bg-superficie shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
              <Editable valor={embudo.nombre} desactivado={!soyAdmin || pendiente} clase="text-lg font-semibold"
                alGuardar={(v) => ejecutar(() => renombrarEmbudo(subId, embudo.id, v))} />
              <div className="flex-1" />
              {soyAdmin && (
                <button disabled={pendiente} className={`${estilosBoton.fantasma} text-peligro`}
                  onClick={() => confirm(`¿Borrar el embudo «${embudo.nombre}» y TODAS sus oportunidades? No se puede deshacer.`) &&
                    iniciar(async () => {
                      const r = await borrarEmbudo(subId, embudo.id);
                      setAviso(r);
                      if (r.ok) setElegido(embudos.find((x) => x.id !== embudo.id)?.id);
                    })}>
                  <Trash2 className="size-4" /> Borrar embudo
                </button>
              )}
            </div>
            <ol className="divide-y">
              {embudo.etapas.map((et, i) => (
                <li key={et.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="w-6 text-tenue">{i + 1}</span>
                  <Editable valor={et.nombre} desactivado={!soyAdmin || pendiente} clase="flex-1"
                    alGuardar={(v) => ejecutar(() => guardarEtapa(subId, embudo.id, et.id, v))} />
                  <span className="text-xs text-tenue">{porEtapa[et.id] ?? 0} oport.</span>
                  {soyAdmin && (
                    <>
                      <button disabled={i === 0 || pendiente} aria-label="Subir etapa" className="rounded p-1 text-tenue disabled:opacity-30"
                        onClick={() => { const ids = embudo.etapas.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; ejecutar(() => reordenarEtapas(subId, embudo.id, ids)); }}>
                        <ArrowUp className="size-4" />
                      </button>
                      <button disabled={i === embudo.etapas.length - 1 || pendiente} aria-label="Bajar etapa" className="rounded p-1 text-tenue disabled:opacity-30"
                        onClick={() => { const ids = embudo.etapas.map((x) => x.id); [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; ejecutar(() => reordenarEtapas(subId, embudo.id, ids)); }}>
                        <ArrowDown className="size-4" />
                      </button>
                      <button disabled={embudo.etapas.length <= 1 || pendiente} aria-label="Borrar etapa" className="rounded p-1 text-tenue hover:text-peligro disabled:opacity-30"
                        onClick={() => (porEtapa[et.id] ? setBorrando(et) : confirm(`¿Borrar la etapa «${et.nombre}»?`) && ejecutar(() => borrarEtapa(subId, et.id, null)))}>
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {soyAdmin && (
              <form className="flex gap-2 border-t p-4" onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const v = String(new FormData(f).get('etapa') ?? '');
                ejecutar(async () => { const r = await guardarEtapa(subId, embudo.id, null, v); if (r.ok) f.reset(); return r; });
              }}>
                <input name="etapa" required maxLength={80} placeholder="Nueva etapa" className={estiloInput} />
                <button disabled={pendiente} className={estilosBoton.secundario}><Plus className="size-4" /> Añadir</button>
              </form>
            )}
          </section>
        )}
      </div>

      <Modal abierto={nuevo} alCerrar={() => setNuevo(false)} titulo="Crear embudo">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          iniciar(async () => {
            const r = await crearEmbudo(subId, String(fd.get('nombre') ?? ''), String(fd.get('etapas') ?? '').split('\n'));
            setAviso(r);
            if (r.ok) setNuevo(false);
          });
        }}>
          <label className="block"><span className="mb-1 block text-sm font-medium">Nombre</span><input name="nombre" required maxLength={80} className={estiloInput} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Etapas (una por línea, en orden)</span>
            <textarea name="etapas" rows={6} defaultValue={ETAPAS_TIPO} required className={estiloInput} /></label>
          <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.primario}>Crear</button></div>
        </form>
      </Modal>

      <Modal abierto={borrando !== null} alCerrar={() => setBorrando(null)} titulo="Borrar etapa">
        {borrando && embudo && (
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const destino = String(new FormData(e.currentTarget).get('destino') ?? '');
            iniciar(async () => { const r = await borrarEtapa(subId, borrando.id, destino); setAviso(r); if (r.ok) setBorrando(null); });
          }}>
            <p className="text-sm">«{borrando.nombre}» tiene {porEtapa[borrando.id]} oportunidades. ¿A qué etapa las movemos?</p>
            <select name="destino" className={estiloInput}>
              {embudo.etapas.filter((x) => x.id !== borrando.id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.peligro}>Mover y borrar</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Editable({ valor, alGuardar, desactivado, clase }: { valor: string; alGuardar: (v: string) => void; desactivado: boolean; clase?: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor);
  if (!editando) {
    return (
      <span className={`flex items-center gap-2 ${clase ?? ''}`}>
        {valor}
        {!desactivado && <button onClick={() => { setV(valor); setEditando(true); }} aria-label="Renombrar" className="text-tenue hover:text-texto"><Pencil className="size-3.5" /></button>}
      </span>
    );
  }
  return (
    <form className={`flex items-center gap-1 ${clase ?? ''}`} onSubmit={(e) => { e.preventDefault(); if (v.trim()) alGuardar(v.trim()); setEditando(false); }}>
      <input value={v} onChange={(e) => setV(e.target.value)} autoFocus maxLength={80} className={`${estiloInput} py-1`} />
      <button aria-label="Guardar" className="rounded p-1 text-exito"><Check className="size-4" /></button>
      <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar" className="rounded p-1 text-tenue"><X className="size-4" /></button>
    </form>
  );
}
