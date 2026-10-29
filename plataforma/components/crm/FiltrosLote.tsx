'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { estiloInput, estiloInputBase } from '@/components/ui/clases';
import type { Usuario } from '@/lib/crm/tipos';

export function FiltrosLote({ operaciones, usuarios }: { operaciones: Record<string, string>; usuarios: Usuario[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const poner = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.push(`${ruta}?${n.toString()}`);
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <select value={sp.get('estado') ?? ''} onChange={(e) => poner('estado', e.target.value)} className={`${estiloInputBase} w-auto`} aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="completada">Completada</option>
        <option value="en_curso">En curso</option>
        <option value="error">Error</option>
      </select>
      <select value={sp.get('operacion') ?? ''} onChange={(e) => poner('operacion', e.target.value)} className={`${estiloInputBase} w-auto`} aria-label="Operación">
        <option value="">Todas las acciones</option>
        {Object.entries(operaciones).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={sp.get('usuario') ?? ''} onChange={(e) => poner('usuario', e.target.value)} className={`${estiloInputBase} w-auto`} aria-label="Usuario">
        <option value="">Todos los usuarios</option>
        {usuarios.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
      </select>
    </div>
  );
}
