'use client';
import { useActionState, useState, useTransition } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Avatar } from './Avatar';
import { Aviso } from './Aviso';
import { BotonEnvio } from './BotonEnvio';
import { Campo, Selector } from './Campo';
import { estiloInput, estiloInputBase } from './clases';
import { fecha } from '@/lib/formato';
import type { Miembro, Resultado } from '@/lib/tipos';

interface Props<R extends string> {
  miembros: Miembro<R>[];
  roles: { valor: R; texto: string }[];
  yo: string;
  puedeGestionar: boolean;
  extra?: Record<string, string>; // campos ocultos (p. ej. subcuenta_id)
  agregar: (prev: Resultado | null, fd: FormData) => Promise<Resultado>;
  cambiarRol: (usuarioId: string, rol: R) => Promise<Resultado>;
  quitar: (usuarioId: string) => Promise<Resultado>;
}

export function Equipo<R extends string>({ miembros, roles, yo, puedeGestionar, extra, agregar, cambiarRol, quitar }: Props<R>) {
  const [estado, accion] = useActionState(agregar, null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const texto = (r: R) => roles.find((x) => x.valor === r)?.texto ?? r;

  return (
    <div className="space-y-5">
      {puedeGestionar && (
        <form action={accion} className="rounded-xl border bg-superficie p-4 shadow-sm">
          {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <p className="mb-3 font-medium">Añadir usuario</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <Campo etiqueta="Correo electrónico" name="email" type="email" required />
            <Selector etiqueta="Rol" name="rol" defaultValue={roles[roles.length - 1].valor} opciones={roles} />
            <BotonEnvio><UserPlus className="size-4" /> Añadir</BotonEnvio>
          </div>
          <p className="mt-2 text-xs text-tenue">Si el correo aún no tiene cuenta, se le envía una invitación para crear su contraseña.</p>
          <div className="mt-3"><Aviso estado={estado} /></div>
        </form>
      )}

      {aviso && !aviso.ok && <Aviso estado={aviso} />}

      <div className="overflow-x-auto rounded-xl border bg-superficie shadow-sm">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-superficie-2 text-left text-tenue">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Desde</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {miembros.map((m) => (
              <tr key={m.usuario_id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar nombre={m.nombre || m.email} tam="size-8" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.nombre || m.email.split('@')[0]}{m.usuario_id === yo && <span className="text-tenue"> (tú)</span>}</p>
                      <p className="truncate text-xs text-tenue">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {puedeGestionar && m.usuario_id !== yo ? (
                    <select
                      aria-label={`Rol de ${m.email}`}
                      defaultValue={m.rol}
                      disabled={pendiente}
                      onChange={(e) => {
                        const rol = e.target.value as R;
                        iniciar(async () => setAviso(await cambiarRol(m.usuario_id, rol)));
                      }}
                      className={`${estiloInputBase} w-40 py-1.5`}
                    >
                      {roles.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
                    </select>
                  ) : (
                    texto(m.rol)
                  )}
                </td>
                <td className="px-4 py-3 text-tenue">{fecha(m.creado)}</td>
                <td className="px-4 py-3 text-right">
                  {puedeGestionar && m.usuario_id !== yo && (
                    <button
                      disabled={pendiente}
                      onClick={() => {
                        if (confirm(`¿Quitar el acceso a ${m.email}?`)) iniciar(async () => setAviso(await quitar(m.usuario_id)));
                      }}
                      aria-label={`Quitar a ${m.email}`}
                      className="rounded p-1.5 text-tenue hover:text-peligro"
                    >
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
  );
}
