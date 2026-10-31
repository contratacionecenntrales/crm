// Chat web: tipos compartidos entre el servidor, la ventana pública y los ajustes.
export interface ConfigChat {
  titulo: string;
  subtitulo: string;
  saludo: string;
  color: string;
  posicion: 'derecha' | 'izquierda';
  pedir_telefono: boolean;
  aviso_legal: string;
  dominios: string[];
  empresa: string;
}

export interface MensajeChat {
  id: string;
  direccion: 'entrante' | 'saliente';
  cuerpo: string;
  creado: string;
  autor?: string | null;
}

export interface AjustesChat {
  clave: string;
  activo: boolean;
  titulo: string;
  subtitulo: string;
  saludo: string;
  color: string;
  posicion: 'derecha' | 'izquierda';
  pedir_telefono: boolean;
  aviso_legal: string;
  dominios: string[];
}

export const AJUSTES_CHAT_VACIOS: Omit<AjustesChat, 'clave'> = {
  activo: false, titulo: 'Chatea con nosotros', subtitulo: 'Normalmente respondemos en unos minutos',
  saludo: '¡Hola! ¿En qué podemos ayudarte?', color: '#155eef', posicion: 'derecha', pedir_telefono: false, aviso_legal: '', dominios: [],
};

export const CLAVE_CHAT = /^[0-9a-f]{24}$/;

// ¿Puede usarse desde esa web? Lista vacía = cualquiera (igual que en la base de datos).
export function origenPermitido(dominios: string[], host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return dominios.length === 0 || dominios.some((d) => h === d || h.endsWith('.' + d));
}

// Código para pegar en la web del cliente.
export const codigoInsercion = (web: string, clave: string) =>
  `<script src="${web}/chat-web.js" data-clave="${clave}" async></script>`;
