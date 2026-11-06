import 'server-only';
import https from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { ipPrivada, urlPublica } from './ip';

// Resolución DNS que rechaza direcciones internas. Se usa como «lookup» de la
// propia conexión: la IP comprobada es exactamente la que se conecta (sin
// carrera entre comprobar y conectar, ni trucos de DNS rebinding).
function lookupPublico(host: string, opciones: object, cb: (e: Error | null, a: string | LookupAddress[], f?: number) => void) {
  dnsLookup(host, { all: true }, (err, dirs) => {
    if (err) return cb(err, '');
    const lista = dirs as LookupAddress[];
    if (!lista.length || lista.some((d) => ipPrivada(d.address))) return cb(new Error('La dirección apunta a una red interna.'), '');
    if ((opciones as { all?: boolean }).all) return cb(null, lista);
    cb(null, lista[0].address, lista[0].family);
  });
}

// POST JSON a una URL pública por https, sin seguir redirecciones.
export function postJsonSeguro(url: string, cuerpo: unknown, msTiempo = 10_000): Promise<{ status: number }> {
  if (!urlPublica(url)) return Promise.reject(new Error('La URL no es una dirección https pública.'));
  const datos = Buffer.from(JSON.stringify(cuerpo));
  return new Promise((resolver, rechazar) => {
    const pet = https.request(url, {
      method: 'POST', lookup: lookupPublico as never, timeout: msTiempo,
      headers: { 'Content-Type': 'application/json', 'Content-Length': datos.length, 'User-Agent': 'Metatok-Automatizacion/1.0' },
    }, (res) => {
      res.resume();
      res.on('end', () => resolver({ status: res.statusCode ?? 0 }));
    });
    pet.on('timeout', () => pet.destroy(new Error('El webhook no respondió a tiempo.')));
    pet.on('error', rechazar);
    pet.end(datos);
  });
}

// Resuelve un servidor (p. ej. SMTP) y falla si es una dirección interna.
export function resolverPublico(host: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    lookupPublico(host.replace(/\.$/, ''), {}, (e, dir) => (e ? rechazar(e) : resolver(String(dir))));
  });
}

// Petición HTTPS genérica a una URL pública (paso «Petición HTTP» de los flujos).
// Sin redirecciones, con tiempo máximo y respuesta de como mucho 256 KB.
export function peticionSegura(o: { metodo: string; url: string; cabeceras?: Record<string, string>; cuerpo?: string; ms?: number }): Promise<{ status: number; texto: string; tipo: string }> {
  if (!urlPublica(o.url)) return Promise.reject(new Error('La URL no es una dirección https pública.'));
  const datos = o.cuerpo && o.metodo !== 'GET' && o.metodo !== 'DELETE' ? Buffer.from(o.cuerpo) : null;
  return new Promise((resolver, rechazar) => {
    const pet = https.request(o.url, {
      method: o.metodo, lookup: lookupPublico as never, timeout: o.ms ?? 15_000,
      headers: { 'User-Agent': 'Metatok-Automatizacion/1.0', Accept: 'application/json, text/plain;q=0.9, */*;q=0.5', ...(o.cabeceras ?? {}),
        ...(datos ? { 'Content-Length': datos.length, 'Content-Type': o.cabeceras?.['Content-Type'] ?? o.cabeceras?.['content-type'] ?? 'application/json' } : {}) },
    }, (res) => {
      const trozos: Buffer[] = []; let total = 0;
      res.on('data', (c: Buffer) => { total += c.length; if (total <= 256 * 1024) trozos.push(c); else res.destroy(); });
      res.on('end', () => resolver({ status: res.statusCode ?? 0, texto: Buffer.concat(trozos).toString('utf8'), tipo: String(res.headers['content-type'] ?? '') }));
      res.on('close', () => resolver({ status: res.statusCode ?? 0, texto: Buffer.concat(trozos).toString('utf8'), tipo: String(res.headers['content-type'] ?? '') }));
    });
    pet.on('timeout', () => pet.destroy(new Error('La API no respondió a tiempo.')));
    pet.on('error', rechazar);
    pet.end(datos ?? undefined);
  });
}
