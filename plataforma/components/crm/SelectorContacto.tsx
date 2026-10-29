'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { buscarContactos } from '@/app/subcuenta/[id]/contactos/acciones';
import { estiloInput } from '@/components/ui/clases';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { nombreContacto } from '@/lib/crm/tipos';

type Opcion = { id: string; nombre: string; apellidos: string; email: string | null; telefono: string };

// Campo de búsqueda de contactos que deja el id elegido en un input oculto.
export function SelectorContacto({ subId, name, inicial, requerido }: { subId: string; name: string; inicial?: Opcion | null; requerido?: boolean }) {
  const [elegido, setElegido] = useState<Opcion | null>(inicial ?? null);
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, abierto, () => setAbierto(false));

  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(async () => setOpciones(await buscarContactos(subId, texto)), 250);
    return () => clearTimeout(t);
  }, [texto, abierto, subId]);

  return (
    <div ref={caja} className="relative">
      <input type="hidden" name={name} value={elegido?.id ?? ''} />
      {elegido ? (
        <div className={`${estiloInput} flex items-center justify-between`}>
          <span className="truncate">{nombreContacto(elegido)}{elegido.email && <span className="text-tenue"> · {elegido.email}</span>}</span>
          <button type="button" onClick={() => { setElegido(null); setAbierto(true); }} aria-label="Cambiar contacto" className="text-tenue"><X className="size-4" /></button>
        </div>
      ) : (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} onFocus={() => setAbierto(true)} required={requerido}
            placeholder="Buscar por nombre, correo o teléfono" className={`${estiloInput} pl-9`} />
        </label>
      )}
      {abierto && !elegido && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-superficie shadow-lg">
          {opciones.length === 0 && <li className="px-3 py-2 text-sm text-tenue">Sin resultados</li>}
          {opciones.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => { setElegido(o); setAbierto(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-superficie-2">
                {nombreContacto(o)} <span className="text-tenue">{o.email ?? o.telefono}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
