'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { crearFactura } from '@/app/subcuenta/[id]/pagos/acciones';
import { estiloInputBase, estilosBoton } from '@/components/ui/clases';

export function BotonNuevaFactura({ subId, contactoId = null, texto = 'Nueva factura' }: { subId: string; contactoId?: string | null; texto?: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button type="button" disabled={pendiente} className={estilosBoton.primario}
      onClick={() => iniciar(async () => {
        const r = await crearFactura(subId, contactoId);
        if (r.ok && r.id) router.push(`/subcuenta/${subId}/pagos/facturas/${r.id}`);
        else if (!r.ok) alert(r.error);
      })}>
      {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {texto}
    </button>
  );
}

export function BuscadorFacturas({ inicial }: { inicial: string }) {
  const [t, setT] = useState(inicial);
  const router = useRouter();
  const ruta = usePathname();
  const q = useSearchParams();
  useEffect(() => {
    if (t === inicial) return;
    const id = setTimeout(() => {
      const u = new URLSearchParams(q.toString());
      if (t.trim()) u.set('q', t.trim()); else u.delete('q');
      router.replace(`${ruta}?${u}`);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);
  return (
    <label className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Buscar por número" className={`${estiloInputBase} h-9 w-48 pl-8`} />
    </label>
  );
}
