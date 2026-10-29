export const MONEDAS = [
  { valor: 'EUR', texto: 'Euro (€)' },
  { valor: 'USD', texto: 'Dólar estadounidense ($)' },
  { valor: 'GBP', texto: 'Libra esterlina (£)' },
  { valor: 'MXN', texto: 'Peso mexicano (MX$)' },
  { valor: 'COP', texto: 'Peso colombiano (COL$)' },
  { valor: 'ARS', texto: 'Peso argentino (AR$)' },
  { valor: 'CLP', texto: 'Peso chileno (CLP$)' },
];

export const ZONAS_HORARIAS = [
  'Europe/Madrid', 'Atlantic/Canary', 'Europe/Lisbon', 'Europe/London', 'Europe/Paris',
  'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/New_York', 'America/Los_Angeles', 'UTC',
].map((z) => ({ valor: z, texto: z.replace(/_/g, ' ') }));

export const PAISES = [
  { valor: 'ES', texto: 'España' }, { valor: 'PT', texto: 'Portugal' }, { valor: 'MX', texto: 'México' },
  { valor: 'CO', texto: 'Colombia' }, { valor: 'AR', texto: 'Argentina' }, { valor: 'CL', texto: 'Chile' },
  { valor: 'PE', texto: 'Perú' }, { valor: 'US', texto: 'Estados Unidos' }, { valor: 'GB', texto: 'Reino Unido' },
  { valor: 'FR', texto: 'Francia' }, { valor: 'IT', texto: 'Italia' }, { valor: 'DE', texto: 'Alemania' },
];
