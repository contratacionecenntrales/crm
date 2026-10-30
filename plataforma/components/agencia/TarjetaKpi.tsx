import { Info } from 'lucide-react';

export function TarjetaKpi({ icono, titulo, valor, ayuda }: { icono: React.ReactNode; titulo: string; valor: string; ayuda: string }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-5 shadow-[0_1px_3px_rgba(16,24,40,0.1)]">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-[#f2f4f7] text-[#101828] dark:bg-superficie-2 dark:text-texto">{icono}</span>
      <div className="mt-4 flex items-start justify-between gap-2">
        <p className="text-base leading-6 text-[#475467] dark:text-texto-2">{titulo}</p>
        <span title={ayuda} aria-label={ayuda} className="text-tenue">
          <Info className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-[28px] font-medium leading-9 text-[#101828] dark:text-texto">{valor}</p>
    </div>
  );
}
