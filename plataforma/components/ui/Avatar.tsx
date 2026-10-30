import { iniciales } from '@/lib/formato';

// Pares fondo pastel / texto como las iniciales de contacto del original.
const PASTEL = [
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-lime-100 text-lime-700', 'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-700', 'bg-yellow-100 text-yellow-700', 'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700', 'bg-cyan-100 text-cyan-700',
];

const COLORES = [
  'bg-orange-500', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-600',
];

function hash(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
const colorDe = (t: string) => COLORES[hash(t) % COLORES.length];

export function Avatar({ nombre, url, tam = 'size-10', suave = false, pastel = false }: { nombre: string; url?: string | null; tam?: string; suave?: boolean; pastel?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${tam} shrink-0 rounded-full border object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        suave ? 'border bg-superficie-2 text-tenue' : pastel ? PASTEL[hash(nombre) % PASTEL.length] : `${colorDe(nombre)} text-white`
      } ${tam}`}
    >
      {iniciales(nombre)}
    </span>
  );
}
