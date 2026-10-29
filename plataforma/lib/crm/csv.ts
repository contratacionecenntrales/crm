// CSV sin dependencias: comillas, comillas dobles escapadas, saltos de línea
// dentro de campos, separador , o ; (Excel en español usa ;) y BOM.

export function detectarSeparador(texto: string): ',' | ';' | '\t' {
  const primera = texto.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const cuenta = (c: string) => primera.split(c).length - 1;
  const opciones: (',' | ';' | '\t')[] = [',', ';', '\t'];
  return opciones.reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ',');
}

export function leerCsv(texto: string, separador = detectarSeparador(texto)): string[][] {
  const t = texto.replace(/^\uFEFF/, '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"' && campo === '') comillas = true;
    else if (c === separador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

function celda(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join(', ') : String(v);
  // Evita la inyección de fórmulas al abrir el CSV en Excel o Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function escribirCsv(cabecera: string[], filas: unknown[][]): string {
  return '\uFEFF' + [cabecera, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';
}

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Sugerencia automática de a qué campo va cada columna del CSV.
const SINONIMOS: Record<string, string[]> = {
  nombre: ['nombre', 'first name', 'firstname', 'name', 'nombre de pila'],
  apellidos: ['apellidos', 'apellido', 'last name', 'lastname', 'surname'],
  nombre_completo: ['nombre completo', 'full name', 'contact name', 'contacto'],
  email: ['email', 'correo', 'correo electronico', 'e-mail', 'mail'],
  telefono: ['telefono', 'phone', 'movil', 'mobile', 'tel', 'celular', 'whatsapp'],
  empresa: ['empresa', 'company', 'company name', 'nombre de la empresa', 'negocio', 'business name'],
  etiquetas: ['etiquetas', 'tags', 'etiqueta', 'tag'],
  fuente: ['fuente', 'source', 'origen', 'fuente de contacto'],
  tipo: ['tipo', 'type', 'tipo de contacto'],
  direccion: ['direccion', 'address', 'address1', 'direccion postal', 'calle'],
  ciudad: ['ciudad', 'city', 'localidad', 'poblacion'],
  provincia: ['provincia', 'state', 'region', 'estado'],
  codigo_postal: ['codigo postal', 'cp', 'postal code', 'zip', 'postal'],
  pais: ['pais', 'country'],
  web: ['web', 'website', 'sitio web', 'url'],
  fecha_nacimiento: ['fecha de nacimiento', 'date of birth', 'nacimiento', 'birthday', 'dob'],
};

export function sugerirMapeo(cabecera: string[], camposPersonalizados: { clave: string; nombre: string }[]): string[] {
  const usados = new Set<string>();
  return cabecera.map((h) => {
    const n = quitarTildes(h.trim().toLowerCase()).replace(/[_]+/g, ' ');
    for (const [campo, lista] of Object.entries(SINONIMOS)) {
      if (!usados.has(campo) && lista.includes(n)) {
        usados.add(campo);
        return campo;
      }
    }
    const p = camposPersonalizados.find((c) => quitarTildes(c.nombre.toLowerCase()) === n || c.clave === n.replace(/ /g, '_'));
    if (p && !usados.has('campo:' + p.clave)) {
      usados.add('campo:' + p.clave);
      return 'campo:' + p.clave;
    }
    return '';
  });
}

// Teléfono al formato que guarda la base de datos: + y dígitos.
export function normalizarTelefono(v: string, prefijo = '+34'): string {
  const limpio = v.replace(/[^\d+]/g, '');
  if (!limpio) return '';
  if (limpio.startsWith('+')) return '+' + limpio.slice(1).replace(/\+/g, '');
  if (limpio.startsWith('00')) return '+' + limpio.slice(2);
  // Número nacional: se le antepone el prefijo de la subcuenta.
  return prefijo.replace(/[^\d+]/g, '') + limpio;
}

export function slug(texto: string): string {
  const s = quitarTildes(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return /^[a-z]/.test(s) ? s : ('c_' + s).slice(0, 50);
}
