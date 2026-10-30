'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { Building2, Copy, Home, Pencil, Plus, Search, Trash2, User, X } from 'lucide-react';
import { anadirUsuario, cambiarRolUsuario, quitarUsuario } from '@/app/agencia/configuracion/acciones';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import type { Resultado } from '@/lib/tipos';

export interface FilaUsuario {
  usuario_id: string; email: string; nombre: string; telefono: string; tipo: 'agencia' | 'subcuenta'; rol: string;
  subcuenta_id: string | null; subcuenta_nombre: string | null;
}

// Mismas etiquetas que el original.
const etiquetaTipo = (f: FilaUsuario) =>
  f.tipo === 'agencia'
    ? { propietario: 'Agency Owner', admin: 'Agency - admin', usuario: 'Agency - user' }[f.rol] ?? f.rol
    : f.rol === 'admin' ? 'Account - admin' : 'Account - user';

export function TablaUsuarios({ filas, subcuentas, yo, soyPropietario }: { filas: FilaUsuario[]; subcuentas: { id: string; nombre: string }[]; yo: string; soyPropietario: boolean }) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [rol, setRol] = useState('');
  const [sub, setSub] = useState('');
  const [tam, setTam] = useState(20);
  const [pagina, setPagina] = useState(1);
  const [dialogo, setDialogo] = useState<null | 'nuevo' | FilaUsuario>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  const filtradas = useMemo(() => filas.filter((f) => {
    const t = q.trim().toLowerCase();
    return (!t || f.email.toLowerCase().includes(t) || f.nombre.toLowerCase().includes(t)) &&
      (!tipo || f.tipo === tipo) && (!rol || (rol === 'admin' ? ['admin', 'propietario'].includes(f.rol) : f.rol === rol)) &&
      (!sub || f.subcuenta_id === sub);
  }), [filas, q, tipo, rol, sub]);
  useEffect(() => setPagina(1), [q, tipo, rol, sub, tam]);
  const visibles = filtradas.slice((pagina - 1) * tam, pagina * tam);
  const paginas = Math.max(1, Math.ceil(filtradas.length / tam));

  const chip = (icono: React.ReactNode, texto: string, valor: string, set: (v: string) => void, opciones: [string, string][]) => (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-borde-fuerte bg-superficie pl-3 pr-2 text-sm text-texto-2">
      {icono}{texto}
      <select value={valor} onChange={(e) => set(e.target.value)} aria-label={texto} className="bg-transparent font-medium text-texto outline-none">
        <option value="">Todo</option>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {valor && <button onClick={() => set('')} aria-label={`Quitar filtro ${texto}`}><X className="size-3.5" /></button>}
    </span>
  );

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium text-texto">Usuarios</h1>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chip(<User className="size-3.5" />, 'Tipo de usuario', tipo, setTipo, [['agencia', 'Agencia'], ['subcuenta', 'Subcuenta']])}
        {chip(<User className="size-3.5" />, 'Rol de usuario', rol, setRol, [['admin', 'Administrador'], ['usuario', 'Usuario']])}
        {chip(<Building2 className="size-3.5" />, 'Subcuenta', sub, setSub, subcuentas.map((s) => [s.id, s.nombre]))}
        <div className="flex-1" />
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nombre, correo electrónico" className={`${estiloInput} w-56 pl-8`} />
        </label>
        <button className={`${estilosBoton.primario} h-8`} onClick={() => setDialogo('nuevo')}><Plus className="size-4" /> Añadir usuario</button>
      </div>
      {aviso && !aviso.ok && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-b border-borde text-left">
            <tr>{['Nombre', 'Correo electrónico', 'Número de teléfono', 'Tipo de usuario', 'Subcuenta', 'Acciones'].map((h, i) => (
              <th key={h} className={`border-l border-borde px-3 py-3 font-semibold text-texto first:border-l-0 ${i === 5 ? 'text-center' : ''}`}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-tenue">No hay usuarios con estos filtros.</td></tr>}
            {visibles.map((f) => (
              <tr key={`${f.tipo}-${f.usuario_id}-${f.subcuenta_id}`} className="border-b border-borde last:border-0">
                <td className="px-3 py-2.5"><span className="flex items-center gap-2 font-medium text-texto"><Avatar nombre={f.nombre || f.email} tam="size-8 text-xs" pastel />{f.nombre || f.email.split('@')[0]}</span></td>
                <td className="px-3 py-2.5">
                  <span className="block font-medium text-texto">{f.email}</span>
                  <span className="flex items-center gap-1 text-xs text-tenue">id: {f.usuario_id.slice(0, 20)}
                    <button aria-label="Copiar id" onClick={() => void navigator.clipboard?.writeText(f.usuario_id)}><Copy className="size-3" /></button></span>
                </td>
                <td className="px-3 py-2.5 text-texto">{f.telefono || '-'}</td>
                <td className={`px-3 py-2.5 text-xs ${f.rol === 'propietario' ? 'font-medium text-[#067647]' : 'text-texto'}`}>{etiquetaTipo(f)}</td>
                <td className="max-w-48 truncate px-3 py-2.5 text-xs text-texto">{f.subcuenta_nombre ?? '—'}</td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={() => setDialogo(f)} aria-label={`Editar ${f.email}`} className="rounded p-1.5 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>
                  <button disabled={pendiente || f.usuario_id === yo} aria-label={`Quitar ${f.email}`} className="rounded p-1.5 text-texto-2 hover:text-peligro disabled:opacity-30"
                    onClick={() => confirm(`¿Quitar el acceso de ${f.email}${f.subcuenta_nombre ? ` a ${f.subcuenta_nombre}` : ' a la agencia'}?`) &&
                      iniciar(async () => setAviso(await quitarUsuario(f.tipo, f.usuario_id, f.subcuenta_id)))}>
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-2 text-xs text-texto-2">
          Rows per page
          <select value={tam} onChange={(e) => setTam(Number(e.target.value))} className="h-7 rounded border border-borde-fuerte bg-superficie px-1" aria-label="Filas por página">
            {[10, 20, 50].map((n) => <option key={n}>{n}</option>)}
          </select>
          <span>{filtradas.length ? (pagina - 1) * tam + 1 : 0} - {Math.min(pagina * tam, filtradas.length)} of {filtradas.length}</span>
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="h-7 rounded border border-borde-fuerte px-2 disabled:opacity-40">Anterior</button>
          <span className="inline-flex size-7 items-center justify-center rounded border border-texto">{pagina}</span>
          <button disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} className="h-7 rounded border border-borde-fuerte px-2 disabled:opacity-40">Siguiente</button>
        </div>
      </div>
      <nav className="mt-4 flex items-center gap-2 text-sm text-tenue" aria-label="Ruta">
        <Link href="/agencia" aria-label="Inicio"><Home className="size-4" /></Link> / <span>Configuración</span> / <span className="text-primario">Usuarios</span>
      </nav>

      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nuevo' ? 'Añadir usuario' : 'Editar usuario'}>
        {dialogo === 'nuevo' && <NuevoUsuario subcuentas={subcuentas} soyPropietario={soyPropietario} alTerminar={() => setDialogo(null)} />}
        {dialogo && dialogo !== 'nuevo' && (
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const nuevo = String(new FormData(e.currentTarget).get('rol'));
            iniciar(async () => { const r = await cambiarRolUsuario(dialogo.tipo, dialogo.usuario_id, dialogo.subcuenta_id, nuevo); setAviso(r); if (r.ok) setDialogo(null); });
          }}>
            <p className="text-sm"><strong>{dialogo.email}</strong>{dialogo.subcuenta_nombre ? ` · ${dialogo.subcuenta_nombre}` : ' · Agencia'}</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Rol</span>
              <select name="rol" defaultValue={dialogo.rol} disabled={dialogo.usuario_id === yo} className={estiloInput}>
                {dialogo.tipo === 'agencia' ? (
                  <>{soyPropietario && <option value="propietario">Propietario</option>}<option value="admin">Administrador</option><option value="usuario">Usuario</option></>
                ) : (<><option value="admin">Administrador</option><option value="usuario">Usuario</option></>)}
              </select>
              {dialogo.usuario_id === yo && <span className="mt-1 block text-xs text-tenue">No puedes cambiar tu propio rol.</span>}
            </label>
            <div className="flex justify-end"><button disabled={pendiente || dialogo.usuario_id === yo} className={estilosBoton.primario}>Guardar</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function NuevoUsuario({ subcuentas, soyPropietario, alTerminar }: { subcuentas: { id: string; nombre: string }[]; soyPropietario: boolean; alTerminar: () => void }) {
  const [estado, accion] = useActionState(anadirUsuario, null);
  const [tipo, setTipo] = useState<'agencia' | 'subcuenta'>('subcuenta');
  useEffect(() => { if (estado?.ok) setTimeout(alTerminar, 900); }, [estado, alTerminar]);
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Correo electrónico" name="email" type="email" required />
      <div className="grid grid-cols-2 gap-2">
        {(['subcuenta', 'agencia'] as const).map((t) => (
          <label key={t} className={`cursor-pointer rounded-lg border-2 p-3 text-sm ${tipo === t ? 'border-primario' : 'border-borde'}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="mr-2" />
            {t === 'subcuenta' ? 'Usuario de subcuenta' : 'Usuario de agencia'}
          </label>
        ))}
      </div>
      {tipo === 'subcuenta' && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Subcuenta</span>
          <select name="subcuenta_id" required className={estiloInput}>{subcuentas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Rol</span>
        <select name="rol" key={tipo} defaultValue="usuario" className={estiloInput}>
          {tipo === 'agencia' && soyPropietario && <option value="propietario">Propietario</option>}
          <option value="admin">Administrador</option>
          <option value="usuario">Usuario</option>
        </select>
      </label>
      <p className="text-xs text-tenue">Si el correo no tiene cuenta, se le envía una invitación para crear su contraseña.</p>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Añadir</BotonEnvio></div>
    </form>
  );
}
