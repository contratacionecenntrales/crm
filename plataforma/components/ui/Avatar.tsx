import { iniciales } from '@/lib/formato';

const COLORES = [
  'bg-orange-500', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-600',
];

function colorDe(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

export function Avatar({ nombre, url, tam = 'size-10', suave = false }: { nombre: string; url?: string | null; tam?: string; suave?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${tam} shrink-0 rounded-full border object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${tam} inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        suave ? 'bg-superficie-2 text-tenue border' : `${colorDe(nombre)} text-white`
      }`}
    >
      {iniciales(nombre)}
    </span>
  );
}
