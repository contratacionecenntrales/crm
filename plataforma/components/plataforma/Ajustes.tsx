'use client';
import { useActionState, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { altaAdminPlataforma, bajaAdminPlataforma, guardarAjustesPlataforma } from '@/app/plataforma/acciones';
import { SeccionAjuste, Interruptor } from '@/components/ajustes/Piezas';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estiloInput } from '@/components/ui/clases';
import type { Resultado } from '@/lib/tipos';

interface Ajustes { nombre: string; registro_abierto: boolean; plan_defecto: string | null; dias_prueba: number }

export function AjustesPlataforma({ ajustes: a, planes, admins, yo }: {
  ajustes: Ajustes | null; planes: { id: string; nombre: string }[]; admins: { usuario_id: string; email: string; rol: string; creado: string }[]; yo: string;
}) {
  const [eA, accA] = useActionState(guardarAjustesPlataforma, null);
  const [eB, accB] = useActionState(altaAdminPlataforma, null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-[28px] font-medium leading-9 text-texto">Ajustes de la plataforma</h1>
      <form action={accA}>
        <SeccionAjuste titulo="Plataforma" descripcion="Nombre que ven las agencias en sus avisos y en la pantalla de plan.">
          <Campo etiqueta="Nombre de la plataforma" name="nombre" required maxLength={60} defaultValue={a?.nombre ?? 'Metatok'} />
        </SeccionAjuste>
        <SeccionAjuste titulo="Alta de agencias" descripcion="Cerrado: solo la plataforma crea agencias (Agencias → Crear agencia). Abierto: cualquiera con cuenta puede crear la suya.">
          <div className="space-y-4">
            <Interruptor name="registro_abierto" defaultChecked={a?.registro_abierto} etiqueta="Permitir que cualquier usuario cree su agencia" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Plan por defecto</span>
                <select name="plan_defecto" defaultValue={a?.plan_defecto ?? ''} className={estiloInput}>
                  <option value="">Sin plan (sin límites)</option>
                  {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></label>
              <Campo etiqueta="Días de prueba" name="dias_prueba" type="number" min={0} max={365} defaultValue={String(a?.dias_prueba ?? 14)} ayuda="Para las agencias que se dan de alta solas." />
            </div>
          </div>
        </SeccionAjuste>
        <div className="flex items-center justify-end gap-3 py-4"><Aviso estado={eA} /><BotonEnvio>Guardar</BotonEnvio></div>
      </form>

      <SeccionAjuste titulo="Administradores" descripcion="Personas que gestionan la plataforma. «Soporte» puede gestionar agencias pero no planes, ajustes ni administradores.">
        <div className="space-y-4">
          <ul className="divide-y divide-borde rounded-lg border border-borde">
            {admins.map((u) => (
              <li key={u.usuario_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-texto">{u.email}{u.usuario_id === yo && <span className="text-tenue"> (tú)</span>}</span>
                <Insignia tono={u.rol === 'superadmin' ? 'azul' : 'gris'}>{u.rol}</Insignia>
                <button disabled={pendiente || u.usuario_id === yo} aria-label={`Quitar a ${u.email}`} className="rounded p-1.5 text-texto-2 hover:text-peligro disabled:opacity-30"
                  onClick={() => confirm(`¿Quitar a ${u.email} como administrador?`) && iniciar(async () => setAviso(await bajaAdminPlataforma(u.usuario_id)))}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          {aviso && !aviso.ok && <Aviso estado={aviso} />}
          <form action={accB} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <Campo etiqueta="Añadir administrador (correo con cuenta)" name="email" type="email" required />
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Rol</span>
              <select name="rol" className={estiloInput}><option value="superadmin">Superadmin</option><option value="soporte">Soporte</option></select></label>
            <BotonEnvio>Añadir</BotonEnvio>
          </form>
          <Aviso estado={eB} />
        </div>
      </SeccionAjuste>
    </div>
  );
}
