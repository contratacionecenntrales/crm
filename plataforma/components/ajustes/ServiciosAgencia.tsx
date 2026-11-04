'use client';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Download, Mail, Pencil, Search } from 'lucide-react';
import { cambiarVerificacionCorreo, verificacionTodas } from '@/app/agencia/configuracion/acciones-servicios';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { Interruptor } from './Piezas';
import type { FilaServicios } from '@/lib/conversaciones/agencia';
import type { Resultado } from '@/lib/tipos';

function useBusqueda(filas: FilaServicios[]) {
  const [q, setQ] = useState('');
  const lista = useMemo(() => filas.filter((f) => !q || f.nombre.toLowerCase().includes(q.toLowerCase())), [filas, q]);
  const caja = (
    <label className="relative block w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre de subcuenta" className={`${estiloInput} pl-9`} />
    </label>
  );
  return { lista, caja };
}

const PROVEEDOR = { mailgun: 'Mailgun', smtp: 'SMTP' } as const;
const dominioDe = (f: FilaServicios) => f.mailgun_dominio || f.correo_remitente.split('@')[1] || '';

export function TablaCorreoSubcuentas({ filas, hayDefecto }: { filas: FilaServicios[]; hayDefecto: boolean }) {
  const { lista, caja } = useBusqueda(filas);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const todas = filas.length > 0 && filas.every((f) => f.verificar_correos);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-texto">Configuración de correo electrónico para subcuentas</h2>
          <p className="text-sm text-tenue">Cada subcuenta puede usar su propio Mailgun o SMTP; si no, envía con el servicio por defecto de la agencia.</p>
        </div>
        <button disabled={pendiente || !filas.length} onClick={() => iniciar(async () => setAviso(await verificacionTodas(!todas)))} className={estilosBoton.primario}>
          {todas ? 'Quitar la verificación en todas las subcuentas' : 'Habilitar la verificación de correo para todas las subcuentas'}
        </button>
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4">
          <span className="text-sm font-medium text-texto">{filas.length} Subcuentas</span>{caja}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Nombre de la subcuenta</th><th className="px-3 py-2.5">Proveedor</th><th className="px-3 py-2.5">Dominio</th>
                <th className="px-3 py-2.5">Verificación del correo electrónico</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-tenue">No hay subcuentas que coincidan.</td></tr>}
              {lista.map((f) => (
                <tr key={f.subcuenta_id}>
                  <td className="px-4 py-3 font-medium text-texto">{f.nombre}</td>
                  <td className="px-3 py-3">
                    {f.correo_proveedor ? (
                      <span className="flex items-center gap-2 text-texto-2">{PROVEEDOR[f.correo_proveedor]}{!f.correo_clave && <Insignia tono="ambar">Falta la clave</Insignia>}</span>
                    ) : hayDefecto ? <span className="text-texto-2">Servicio de la agencia</span> : <Insignia tono="gris">Sin configurar</Insignia>}
                  </td>
                  <td className="px-3 py-3 text-texto-2">{dominioDe(f) || '—'}</td>
                  <td className="px-3 py-3">
                    <Interruptor checked={f.verificar_correos} disabled={pendiente} ariaLabel={`Verificación de correos en ${f.nombre}`}
                      onChange={(v) => iniciar(async () => { const r = await cambiarVerificacionCorreo(f.subcuenta_id, v); if (!r.ok) setAviso(r); })} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link href={`/subcuenta/${f.subcuenta_id}/configuracion/correo`} aria-label={`Configurar correo de ${f.nombre}`} className="inline-flex rounded p-1.5 text-texto-2 hover:text-primario">
                      <Pencil className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-tenue"><Mail className="mt-0.5 size-3.5 shrink-0" /> Con la verificación activada, antes de cada correo se comprueba que el dominio del destinatario existe y recibe correo; si no, el envío se marca como fallido y no daña tu reputación de remitente.</p>
    </div>
  );
}

const enmascarar = (sid: string) => (sid ? `${sid.slice(0, 8)}*****${sid.slice(-6)}` : '');

export function TablaTelefoniaSubcuentas({ filas, sidAgencia, tokenAgencia }: { filas: FilaServicios[]; sidAgencia: string; tokenAgencia: boolean }) {
  const { lista, caja } = useBusqueda(filas);
  const estado = (f: FilaServicios) => {
    if (f.twilio_sid) return f.twilio_token ? ['Twilio', 'Cuenta propia', 'verde'] as const : ['Twilio', 'Falta el Auth Token', 'ambar'] as const;
    if (sidAgencia && tokenAgencia) return f.twilio_numero_sms ? ['Twilio', 'Cuenta de la agencia', 'azul'] as const : ['Twilio', 'Cuenta de la agencia · sin número', 'ambar'] as const;
    return ['No disponible', 'Sin configurar', 'gris'] as const;
  };

  const exportar = () => {
    const cab = ['Subcuenta', 'Proveedor', 'Estado', 'Account SID', 'Número SMS', 'Número WhatsApp'];
    const celda = (v: string) => (/[";\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"` : v);
    const lineas = filas.map((f) => {
      const [p, e] = estado(f);
      return [f.nombre, p, e, enmascarar(f.twilio_sid || (sidAgencia && tokenAgencia ? sidAgencia : '')), f.twilio_numero_sms, f.twilio_numero_wa].map(celda).join(';');
    });
    const blob = new Blob(['﻿' + [cab.join(';'), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `telefonia-subcuentas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-texto">Teléfono · ajuste para la subcuenta <Insignia tono="gris">{filas.length} Subcuentas</Insignia></h2>
          <p className="text-sm text-tenue">Gestiona la configuración del teléfono de cada subcuenta y su estado.</p>
        </div>
        <button onClick={exportar} disabled={!filas.length} className={`${estilosBoton.secundario} inline-flex items-center gap-1.5`}><Download className="size-4" /> Exportar</button>
      </div>
      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex justify-end border-b border-borde p-4">{caja}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Nombre de la subcuenta</th><th className="px-3 py-2.5">Números</th><th className="px-3 py-2.5">Gestionar vía</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-tenue">No hay subcuentas que coincidan.</td></tr>}
              {lista.map((f) => {
                const [p, e, tono] = estado(f);
                const sid = f.twilio_sid;
                return (
                  <tr key={f.subcuenta_id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-texto">{f.nombre}</p>
                      {sid && <p className="flex items-center gap-1 font-mono text-xs text-tenue">{enmascarar(sid)}<BotonCopiar texto={sid} etiqueta="Copiar Account SID" /></p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-texto-2">
                      {f.twilio_numero_sms ? <p>SMS {f.twilio_numero_sms}</p> : <p className="text-tenue">Sin número</p>}
                      {f.twilio_numero_wa && <p>WhatsApp {f.twilio_numero_wa}</p>}
                    </td>
                    <td className="px-3 py-3"><span className="flex flex-col items-start gap-1"><Insignia tono={tono}>{p}</Insignia><span className="text-xs text-tenue">{e}</span></span></td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/subcuenta/${f.subcuenta_id}/configuracion/telefonia`} aria-label={`Configurar teléfono de ${f.nombre}`} className="inline-flex rounded p-1.5 text-texto-2 hover:text-primario">
                        <Pencil className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
