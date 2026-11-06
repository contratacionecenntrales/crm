'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Building2, LogIn, Plus, Settings2 } from 'lucide-react';
import { crearSubagencia, gestionarSubagencia } from '@/app/agencia/subagencias/acciones';
import { cambiarAgencia } from '@/app/acciones-panel';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { MONEDAS, ZONAS_HORARIAS } from '@/lib/opciones';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

export interface FilaSubagencia {
  id: string; nombre: string; suspendida: boolean; operativa: boolean; limite: number | null; subcuentas: number; usuarios: number; nietas: number;
  dueno_email: string | null; creado: string; acceso: boolean;
}

export function Subagencias({ filas, puedeCrear, agencia }: { filas: FilaSubagencia[]; puedeCrear: boolean; agencia: string }) {
  const router = useRouter();
  const [nueva, setNueva] = useState(false);
  const [gestion, setGestion] = useState<FilaSubagencia | null>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const totales = filas.reduce((t, f) => ({ subcuentas: t.subcuentas + f.subcuentas, usuarios: t.usuarios + f.usuarios }), { subcuentas: 0, usuarios: 0 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Subagencias</h1>
          <p className="text-xs text-tenue">Agencias que revenden tu plataforma: cada una tiene su dueño, su marca y sus propios clientes. Tú las supervisas desde aquí.</p>
        </div>
        {puedeCrear && <button onClick={() => { setNueva(true); setAviso(null); }} className={estilosBoton.primario}><Plus className="size-4" /> Crear subagencia</button>}
      </div>
      {!puedeCrear && <p className="mb-3 rounded-lg border border-borde bg-superficie-2 px-3 py-2 text-sm text-texto-2">Tu plan no permite crear más subagencias (o ya estás en el tercer nivel).</p>}
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[['Subagencias', filas.length], ['Subcuentas de sus clientes', totales.subcuentas], ['Usuarios', totales.usuarios]].map(([t, v]) => (
          <div key={t as string} className="min-w-0 rounded-lg border border-borde bg-superficie p-3"><p className="truncate text-xs text-tenue">{t}</p><p className="mt-1 text-xl font-semibold text-texto">{v}</p></div>
        ))}
      </div>
      {filas.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie px-6 py-16 text-center">
          <Building2 className="size-10 text-tenue" />
          <p className="mt-3 font-medium text-texto">Aún no tienes subagencias</p>
          <p className="mt-1 max-w-md text-sm text-tenue">Crea una para un socio o revendedor: tendrá su propia agencia completa (subcuentas, asistentes, embudos, automatizaciones) colgando de {agencia}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Subagencia</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Subcuentas</th><th className="px-3 py-2.5">Usuarios</th><th className="px-3 py-2.5">Sus subagencias</th><th className="px-3 py-2.5">Alta</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3"><p className="font-medium text-texto">{f.nombre}</p><p className="text-xs text-tenue">{f.dueno_email ?? 'Sin dueño'}</p></td>
                  <td className="px-3 py-3"><Insignia tono={f.suspendida ? 'rojo' : f.operativa ? 'verde' : 'gris'}>{f.suspendida ? 'Suspendida por ti' : f.operativa ? 'Activa' : 'Inactiva'}</Insignia></td>
                  <td className="px-3 py-3 text-texto-2">{f.subcuentas}{f.limite !== null && <span className="text-tenue"> / {f.limite}</span>}</td>
                  <td className="px-3 py-3 text-texto-2">{f.usuarios}</td>
                  <td className="px-3 py-3 text-texto-2">{f.nietas}</td>
                  <td className="px-3 py-3 text-xs text-texto-2">{fecha(f.creado)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-flex gap-1">
                      {f.acceso && <button disabled={pendiente} onClick={() => iniciar(async () => { const r = await cambiarAgencia(f.id); if (r && !r.ok) setAviso(r); })} className={estilosBoton.secundario} title="Entrar como soporte"><LogIn className="size-4" /> Entrar</button>}
                      <button onClick={() => setGestion(f)} aria-label={`Gestionar ${f.nombre}`} className={estilosBoton.icono}><Settings2 className="size-4" /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal abierto={nueva} alCerrar={() => setNueva(false)} titulo="Crear subagencia">
        {nueva && <FormNueva alTerminar={(r) => { setNueva(false); setAviso(r); router.refresh(); }} />}
      </Modal>
      <Modal abierto={gestion !== null} alCerrar={() => setGestion(null)} titulo={gestion ? `Gestionar «${gestion.nombre}»` : ''}>
        {gestion && <FormGestion f={gestion} alTerminar={(r) => { setGestion(null); setAviso(r); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

function FormNueva({ alTerminar }: { alTerminar: (r: Resultado) => void }) {
  const [d, setD] = useState({ nombre: '', email: '', moneda: 'EUR', zona: 'Europe/Madrid', soporte: true });
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await crearSubagencia(d); if (x.ok) alTerminar(x); else setR(x); }); }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre de la subagencia</span>
        <input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} required minLength={2} maxLength={120} className={estiloInput} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Correo del dueño</span>
        <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} required maxLength={200} className={estiloInput} />
        <span className="mt-1 block text-xs text-tenue">Si aún no tiene cuenta, recibirá una invitación para crear su contraseña.</span></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Moneda</span>
          <select value={d.moneda} onChange={(e) => setD({ ...d, moneda: e.target.value })} className={estiloInput}>{MONEDAS.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Zona horaria</span>
          <select value={d.zona} onChange={(e) => setD({ ...d, zona: e.target.value })} className={estiloInput}>{ZONAS_HORARIAS.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</select></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={d.soporte} onChange={(e) => setD({ ...d, soporte: e.target.checked })} className="mt-0.5 size-4" />
        <span><span className="block font-medium">Mantener acceso de soporte</span><span className="text-xs text-tenue">Entrarás como administrador en su agencia para ayudarles. Puedes quitarlo luego desde sus usuarios.</span></span></label>
      <Aviso estado={r} />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => alTerminar({ ok: true })} className={estilosBoton.secundario}>Cancelar</button><button disabled={pendiente} className={estilosBoton.primario}>{pendiente ? 'Creando…' : 'Crear subagencia'}</button></div>
    </form>
  );
}

function FormGestion({ f, alTerminar }: { f: FilaSubagencia; alTerminar: (r: Resultado) => void }) {
  const [suspendida, setSuspendida] = useState(f.suspendida);
  const [limite, setLimite] = useState(f.limite === null ? '' : String(f.limite));
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await gestionarSubagencia(f.id, suspendida, limite.trim() === '' ? null : Number(limite)); if (x.ok) alTerminar(x); else setR(x); }); }}>
      <p className="text-sm text-tenue">{f.dueno_email} · {f.subcuentas} subcuenta(s) · {f.usuarios} usuario(s)</p>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Máximo de subcuentas</span>
        <input value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Sin límite" className={`${estiloInput} w-40`} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={suspendida} onChange={(e) => setSuspendida(e.target.checked)} className="mt-0.5 size-4" />
        <span><span className="block font-medium">Suspender</span><span className="text-xs text-tenue">Ni la subagencia, ni sus clientes, ni sus propias subagencias podrán entrar, y dejarán de funcionar sus páginas, chats y reservas.</span></span></label>
      <Aviso estado={r} />
      <div className="flex justify-end gap-2"><button type="button" onClick={() => alTerminar({ ok: true })} className={estilosBoton.secundario}>Cancelar</button><button disabled={pendiente} className={estilosBoton.primario}>Guardar</button></div>
    </form>
  );
}
