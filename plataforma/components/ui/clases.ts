export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// Botones: 36 px de alto, radio 8, borde #D0D5DD y sombra xs, como el original.
const baseBoton =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60';

export const estilosBoton = {
  primario: `${baseBoton} bg-primario text-white shadow-xs hover:bg-primario-hover`,
  secundario: `${baseBoton} border border-borde-fuerte bg-superficie text-texto-2 shadow-xs hover:bg-superficie-2`,
  peligro: `${baseBoton} bg-peligro text-white shadow-xs hover:opacity-90`,
  fantasma: 'inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-texto-2 hover:bg-superficie-2 hover:text-texto',
  icono: 'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-borde-fuerte bg-superficie text-texto-2 shadow-xs hover:bg-superficie-2',
};

// Campos: radio 4, borde #D0D5DD, 32 px de alto.
export const estiloInputBase =
  'h-8 rounded border border-borde-fuerte bg-superficie px-2.5 text-sm text-texto shadow-xs placeholder:text-tenue focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/20';
export const estiloInput = `w-full ${estiloInputBase}`;
export const estiloArea =
  'w-full rounded border border-borde-fuerte bg-superficie px-2.5 py-1.5 text-sm text-texto shadow-xs placeholder:text-tenue focus:border-primario focus:outline-none focus:ring-2 focus:ring-primario/20';

// Tarjetas: blanco, borde #EAECF0, radio 8.
export const estiloTarjeta = 'rounded-lg border border-borde bg-superficie';
