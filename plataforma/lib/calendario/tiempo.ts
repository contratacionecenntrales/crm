// Fechas en una zona horaria concreta sin librerías: el calendario se dibuja
// siempre en la zona de la subcuenta, sea cual sea la del navegador.
// Un «día» es una cadena AAAA-MM-DD; un instante, un Date (UTC).

export type Dia = string;
export type Vista = 'dia' | 'semana' | 'mes';

const formateadores = new Map<string, Intl.DateTimeFormat>();
function fmt(zona: string) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    formateadores.set(zona, f);
  }
  return f;
}

const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface Partes { y: number; m: number; d: number; h: number; mi: number; s: number; dow: number }

export function partesEn(fecha: Date, zona: string): Partes {
  const p: Record<string, string> = {};
  for (const x of fmt(zona).formatToParts(fecha)) p[x.type] = x.value;
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second),
    dow: DIAS_EN.indexOf(p.weekday),
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

export function diaEn(fecha: Date, zona: string): Dia {
  const p = partesEn(fecha, zona);
  return `${p.y}-${dos(p.m)}-${dos(p.d)}`;
}

export function horaEn(fecha: Date, zona: string): string {
  const p = partesEn(fecha, zona);
  return `${dos(p.h)}:${dos(p.mi)}`;
}

// Minutos que la zona va por delante de UTC en ese instante (+60 en Madrid en invierno).
export function desfaseMin(fecha: Date, zona: string): number {
  const p = partesEn(fecha, zona);
  const local = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((local - Math.floor(fecha.getTime() / 1000) * 1000) / 60000);
}

// Instante que corresponde a un día y una hora "de pared" en la zona.
export function instante(dia: Dia, hhmm: string, zona: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const pared = Date.UTC(y, m - 1, d, h, mi);
  const d1 = desfaseMin(new Date(pared), zona);
  let t = pared - d1 * 60000;
  const d2 = desfaseMin(new Date(t), zona);
  if (d2 !== d1) t = pared - d2 * 60000;
  return new Date(t);
}

export function minutosDelDia(fecha: Date, zona: string): number {
  const p = partesEn(fecha, zona);
  return p.h * 60 + p.mi;
}

export function esDia(s: unknown): s is Dia {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
}

export function esHora(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function sumarDias(dia: Dia, n: number): Dia {
  const t = new Date(dia + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function sumarMeses(dia: Dia, n: number): Dia {
  const [y, m] = dia.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}

export const diaSemana = (dia: Dia) => new Date(dia + 'T00:00:00Z').getUTCDay(); // 0 = domingo
export const inicioSemana = (dia: Dia) => sumarDias(dia, -diaSemana(dia));
export const inicioMes = (dia: Dia) => dia.slice(0, 8) + '01';

export function diasEntre(desde: Dia, hasta: Dia): number {
  return Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000);
}

// Días que pinta cada vista (la semana empieza en domingo, como el original;
// el mes siempre son 6 semanas para que la rejilla no salte).
export function diasDeVista(vista: Vista, dia: Dia): Dia[] {
  if (vista === 'dia') return [dia];
  const desde = vista === 'semana' ? inicioSemana(dia) : inicioSemana(inicioMes(dia));
  const n = vista === 'semana' ? 7 : 42;
  return Array.from({ length: n }, (_, i) => sumarDias(desde, i));
}

export function desplazar(vista: Vista, dia: Dia, sentido: 1 | -1): Dia {
  if (vista === 'dia') return sumarDias(dia, sentido);
  if (vista === 'semana') return sumarDias(dia, 7 * sentido);
  return sumarMeses(dia, sentido);
}

// "GMT +01:00"
export function etiquetaGmt(fecha: Date, zona: string): string {
  const d = desfaseMin(fecha, zona);
  const s = d < 0 ? '-' : '+';
  const a = Math.abs(d);
  return `GMT ${s}${dos(Math.floor(a / 60))}:${dos(a % 60)}`;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const trozos = (dia: Dia) => dia.split('-').map(Number) as [number, number, number];

// Título del rango, como el original: "25 – 31 oct 2026", "28 sept – 4 oct 2026", "octubre de 2026".
export function tituloRango(vista: Vista, dia: Dia): string {
  if (vista === 'mes') {
    const [y, m] = trozos(dia);
    return `${MESES[m - 1]} de ${y}`;
  }
  if (vista === 'dia') {
    const [y, m, d] = trozos(dia);
    return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
  }
  const dias = diasDeVista('semana', dia);
  const [y1, m1, d1] = trozos(dias[0]);
  const [y2, m2, d2] = trozos(dias[6]);
  if (y1 !== y2) return `${d1} ${MESES_CORTOS[m1 - 1]} ${y1} – ${d2} ${MESES_CORTOS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MESES_CORTOS[m1 - 1]} – ${d2} ${MESES_CORTOS[m2 - 1]} ${y2}`;
  return `${d1} – ${d2} ${MESES_CORTOS[m2 - 1]} ${y2}`;
}

export function fechaLarga(dia: Dia): string {
  const [y, m, d] = trozos(dia);
  return `${DIAS_LARGOS[diaSemana(dia)]}, ${d} de ${MESES[m - 1]} de ${y}`;
}

export const nombreMes = (dia: Dia) => {
  const [y, m] = trozos(dia);
  return `${MESES[m - 1]} ${y}`;
};

// Duración legible: 30 → "30 min", 90 → "1 h 30 min".
export function duracionTexto(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// Reparte eventos que se solapan en columnas (como cualquier agenda).
export function columnas<T extends { ini: number; fin: number }>(eventos: T[]): (T & { col: number; cols: number })[] {
  const orden = [...eventos].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const salida: (T & { col: number; cols: number })[] = [];
  let grupo: (T & { col: number; cols: number })[] = [];
  let finGrupo = -Infinity;
  const cerrar = () => {
    const n = Math.max(1, ...grupo.map((g) => g.col + 1));
    grupo.forEach((g) => (g.cols = n));
    salida.push(...grupo);
    grupo = [];
  };
  for (const e of orden) {
    if (e.ini >= finGrupo && grupo.length) cerrar();
    const ocupadas = new Set(grupo.filter((g) => g.fin > e.ini).map((g) => g.col));
    let col = 0;
    while (ocupadas.has(col)) col++;
    grupo.push({ ...e, col, cols: 1 });
    finGrupo = Math.max(finGrupo === -Infinity ? e.fin : finGrupo, e.fin);
  }
  if (grupo.length) cerrar();
  return salida;
}

// "09:30" + 45 → "10:15"; null si se pasa de medianoche.
export function sumarMinutosHora(hhmm: string, min: number): string | null {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + min;
  if (t >= 24 * 60 || t < 0) return null;
  return `${dos(Math.floor(t / 60))}:${dos(t % 60)}`;
}
