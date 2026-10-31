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
