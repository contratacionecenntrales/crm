'use client';
import { useActionState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Printer } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { pagarFactura } from './acciones';

export interface FacturaPublica {
  numero: string; estado: 'enviada' | 'pagada' | 'anulada'; moneda: string; emision: string; vencimiento: string | null; notas: string;
  subtotal: number; impuestos: number; total: number; cobrado: number; pagada_en: string | null; pie: string; cobro_online: boolean;
  empresa: { nombre: string; email: string | null; telefono: string | null; direccion: string; logo_url: string | null };
  cliente: { nombre: string; email: string | null; direccion: string } | null;
  lineas: { descripcion: string; cantidad: number; precio: number; impuesto: number }[];
}

function BotonPagar({ importe }: { importe: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primario px-5 font-semibold text-white shadow-xs hover:bg-primario-hover disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Pagar {importe} con tarjeta
    </button>
  );
}

export function VistaFactura({ token, f, vuelveDePagar }: { token: string; f: FacturaPublica; vuelveDePagar: boolean }) {
  const [estado, accion] = useActionState(pagarFactura.bind(null, token), null);
  const din = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: f.moneda }).format(Number(n));
  const fecha = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));
  const pendiente = Math.max(0, Number(f.total) - Number(f.cobrado));
  return (
    <div className="w-full max-w-3xl self-start">
      {f.estado === 'pagada' && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-[#ecfdf3] px-4 py-3 text-sm font-medium text-[#067647] print:hidden"><CheckCircle2 className="size-5" /> Factura pagada. ¡Gracias!</p>
      )}
      {f.estado === 'enviada' && vuelveDePagar && (
        <p className="mb-4 rounded-lg bg-[#eff8ff] px-4 py-3 text-sm text-[#175cd3] print:hidden">Estamos confirmando tu pago con el banco. Recarga la página en unos segundos.</p>
      )}
      <article className="rounded-xl border border-borde bg-white p-6 text-[#101828] shadow-sm print:border-0 print:shadow-none sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {f.empresa.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={f.empresa.logo_url} alt={f.empresa.nombre} className="mb-3 max-h-14 max-w-[200px] object-contain" />
              : <p className="mb-2 text-lg font-semibold">{f.empresa.nombre}</p>}
            <div className="text-sm text-[#475467]">
              {f.empresa.logo_url && <p className="font-medium text-[#101828]">{f.empresa.nombre}</p>}
              {f.empresa.direccion && <p>{f.empresa.direccion}</p>}
              {f.empresa.email && <p>{f.empresa.email}</p>}
              {f.empresa.telefono && <p>{f.empresa.telefono}</p>}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold">Factura</h1>
            <p className="text-[#475467]">{f.numero}</p>
            {f.estado === 'anulada' && <p className="mt-1 font-semibold text-[#b42318]">ANULADA</p>}
          </div>
        </header>
        <section className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#667085]">Facturado a</p>
            {f.cliente ? (<><p className="font-medium">{f.cliente.nombre || f.cliente.email}</p>{f.cliente.direccion && <p className="text-[#475467]">{f.cliente.direccion}</p>}{f.cliente.email && <p className="text-[#475467]">{f.cliente.email}</p>}</>) : <p className="text-[#475467]">—</p>}
          </div>
          <div className="sm:text-right">
            <p><span className="text-[#667085]">Fecha:</span> {fecha(f.emision)}</p>
            {f.vencimiento && <p><span className="text-[#667085]">Vence:</span> {fecha(f.vencimiento)}</p>}
          </div>
        </section>
        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-[#d0d5dd] text-left text-xs uppercase tracking-wide text-[#667085]">
            <tr><th className="py-2 font-medium">Concepto</th><th className="py-2 pl-4 text-right font-medium">Cant.</th><th className="py-2 pl-4 text-right font-medium">Precio</th><th className="hidden py-2 pl-4 text-right font-medium sm:table-cell">Imp.</th><th className="py-2 pl-4 text-right font-medium">Importe</th></tr>
          </thead>
          <tbody>
            {f.lineas.map((l, i) => (
              <tr key={i} className="border-b border-[#eaecf0]">
                <td className="py-3 pr-2 [overflow-wrap:anywhere]">{l.descripcion}</td>
                <td className="whitespace-nowrap py-3 pl-4 text-right tabular-nums">{Number(l.cantidad).toLocaleString('es-ES')}</td>
                <td className="whitespace-nowrap py-3 pl-4 text-right tabular-nums">{din(l.precio)}</td>
                <td className="hidden whitespace-nowrap py-3 pl-4 text-right tabular-nums sm:table-cell">{Number(l.impuesto)} %</td>
                <td className="whitespace-nowrap py-3 pl-4 text-right tabular-nums">{din(Number(l.cantidad) * Number(l.precio))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-6 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-[#667085]">Subtotal</dt><dd className="tabular-nums">{din(f.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-[#667085]">Impuestos</dt><dd className="tabular-nums">{din(f.impuestos)}</dd></div>
          <div className="flex justify-between border-t border-[#d0d5dd] pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{din(f.total)}</dd></div>
          {Number(f.cobrado) > 0 && f.estado !== 'pagada' && (<>
            <div className="flex justify-between"><dt className="text-[#667085]">Pagado</dt><dd>−{din(f.cobrado)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Pendiente</dt><dd>{din(pendiente)}</dd></div>
          </>)}
        </dl>
        {f.notas && <p className="mt-8 whitespace-pre-line text-sm text-[#475467]">{f.notas}</p>}
        {f.pie && <p className="mt-6 whitespace-pre-line border-t border-[#eaecf0] pt-4 text-xs text-[#667085]">{f.pie}</p>}
      </article>
      <div className="mt-4 flex flex-col-reverse items-stretch gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-borde-fuerte bg-white px-4 text-sm font-semibold text-[#344054] shadow-xs">
          <Printer className="size-4" /> Imprimir o guardar en PDF
        </button>
        {f.estado === 'enviada' && pendiente > 0 && f.cobro_online && (
          <form action={accion}><BotonPagar importe={din(pendiente)} /></form>
        )}
      </div>
      {estado && !estado.ok && <p role="alert" className="mt-3 text-sm text-peligro print:hidden">{estado.error}</p>}
    </div>
  );
}
