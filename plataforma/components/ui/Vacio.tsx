import { Search } from 'lucide-react';

export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-primario-suave text-primario">
        <Search className="size-6" />
      </span>
      <p className="font-medium text-texto">{titulo}</p>
      {texto && <p className="max-w-md text-sm text-tenue">{texto}</p>}
      {children}
    </div>
  );
}
