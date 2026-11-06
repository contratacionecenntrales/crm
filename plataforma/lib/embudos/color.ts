// ¿Texto claro u oscuro sobre este fondo? (luminancia relativa)
export function textoSobre(hex: string): '#101828' | '#ffffff' {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#101828';
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#101828' : '#ffffff';
}

const rgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [21, 94, 239];
};
export const esOscuro = (hex: string) => textoSobre(hex) === '#ffffff';
// Color con transparencia (para sombras, halos y fondos suaves).
export const conAlfa = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
// Mezcla de dos colores (t = 0 → a, t = 1 → b).
export function mezclar(a: string, b: string, t: number): string {
  const x = rgb(a); const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
