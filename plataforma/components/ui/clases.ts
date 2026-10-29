export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const estilosBoton = {
  primario:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primario-hover disabled:opacity-60 disabled:cursor-not-allowed',
  secundario:
    'inline-flex items-center justify-center gap-2 rounded-lg border bg-superficie px-4 py-2 text-sm font-medium text-texto shadow-sm hover:bg-superficie-2 disabled:opacity-60 disabled:cursor-not-allowed',
  peligro:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-peligro px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60',
  fantasma:
    'inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm text-tenue hover:bg-superficie-2 hover:text-texto',
};

export const estiloInput =
  'w-full rounded-lg border bg-superficie px-3 py-2 text-sm text-texto placeholder:text-tenue focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/20';

export const estiloTarjeta = 'rounded-xl border bg-superficie shadow-sm';
