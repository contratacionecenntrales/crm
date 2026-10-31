// Sin node:net: este archivo también se usa en el navegador.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
export function isIP(x: string): 0 | 4 | 6 {
  if (IPV4.test(x)) return 4;
  if (!x.includes(':') || !/^[0-9a-f:.]+$/i.test(x)) return 0;
  try {
    new URL(`http://[${x}]/`);
    return 6;
  } catch {
    return 0;
  }
}

// ¿Es una IP privada, local, reservada o de metadatos? (IPv4, IPv6 y IPv4
// dentro de IPv6: ::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::/96).
export function ipPrivada(ip: string): boolean {
  let x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const v = isIP(x);
  if (v === 0) return true;
  if (v === 6) {
    const m = x.match(/^(?:::ffff:|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (m) x = m[1];
    else {
      const hex = x.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (hex) {
        const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
        x = `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
      } else {
        return x === '::' || x === '::1' || /^(fc|fd|fe[89ab]|ff|2001:db8|2001:0?:|100::)/.test(x) || /^::/.test(x);
      }
    }
  }
  const [a, b] = x.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0) || a >= 224;
}

// Comprobación de forma de una URL de webhook (sin DNS): https y nombre que no sea local.
export function urlPublica(url: string): boolean {
  let h: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  } catch {
    return false;
  }
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(h) || !h.includes('.') && isIP(h) === 0) return false;
  if (isIP(h)) return !ipPrivada(h);
  return true;
}
