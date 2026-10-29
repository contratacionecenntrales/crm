import { Info } from 'lucide-react';

export function TarjetaKpi({ icono, titulo, valor, ayuda }: { icono: React.ReactNode; titulo: string; valor: string; ayuda: string }) {
  return (
    <div className="rounded-xl border bg-superficie p-5 shadow-sm">
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-superficie-2 text-texto">{icono}</span>
      <div className="mt-4 flex items-start justify-between gap-2">
        <p className="text-sm text-texto">{titulo}</p>
        <span title={ayuda} aria-label={ayuda} className="text-tenue">
          <Info className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-medium">{valor}</p>
    </div>
  );
}
