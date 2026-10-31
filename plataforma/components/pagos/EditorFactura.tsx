'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, Ban, ChevronDown, ExternalLink, Loader2, Plus, Save, Send, Trash2, Wallet } from 'lucide-react';
import { borrarFactura, cambiarEstadoFactura, enviarFactura, guardarFactura, reembolsarCobro } from '@/app/subcuenta/[id]/pagos/acciones';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estiloInputBase, estilosBoton } from '@/components/ui/clases';
import { totales } from '@/lib/pagos/calculo';
import { ESTILO_ESTADO, NOMBRE_METODO, estadoVisible, type Factura, type Linea, type Producto, type Transaccion } from '@/lib/pagos/tipos';
import type { Resultado } from '@/lib/tipos';
import { FormularioCobro } from './Cobro';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

export function EditorFactura({ subId, zona, factura: f, lineas: iniciales, productos, cobros, impuestoDefecto, enlace, cobroOnline, soyAdmin }: {
  subId: string; zona: string; factura: Factura; lineas: Linea[]; productos: Producto[]; cobros: Transaccion[];
  impuestoDefecto: number; enlace: string; cobroOnline: boolean; soyAdmin: boolean;
}) {
  const router = useRouter();
  const editable = f.estado === 'borrador' || f.estado === 'enviada';
  const [lineas, setLineas] = useState<Linea[]>(iniciales.length ? iniciales : [{ producto_id: null, descripcion: '', cantidad: 1, precio: 0, impuesto: impuestoDefecto }]);
  const [emision, setEmision] = useState(f.emision);
  const [vencimiento, setVencimiento] = useState(f.vencimiento ?? '');
  const [notas, setNotas] = useState(f.notas);
  const contactoRef = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [menuEnviar, setMenuEnviar] = useState(false);
  const [cobro, setCobro] = useState(false);
  const cajaEnviar = useRef<HTMLDivElement>(null);
  useFueraDe(cajaEnviar, menuEnviar, () => setMenuEnviar(false));
  const t = useMemo(() => totales(lineas), [lineas]);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
  const e = ESTILO_ESTADO[estadoVisible(f, hoy)];
  const din = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: f.moneda }).format(n);
  const porCobrar = Math.max(0, Number(f.total) - Number(f.cobrado));
  const cerrarCobro = useCallback(() => setCobro(false), []);

  const poner = (i: number, cambios: Partial<Linea>) => setLineas((l) => l.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
  const contactoActual = () => {
    const input = contactoRef.current?.querySelector<HTMLInputElement>('input[name="contacto_id"]');
    return input?.value || null;
  };
  const guardar = async () => {
    const r = await guardarFactura(subId, f.id, {
      contacto_id: contactoActual(), emision, vencimiento: vencimiento || null, notas,
      lineas: lineas.filter((l) => l.descripcion.trim() || l.precio).map((l) => ({ ...l, cantidad: Number(l.cantidad), precio: Number(l.precio), impuesto: Number(l.impuesto) })),
    });
    setAviso(r);
    return r.ok;
  };
  const accion = (fn: () => Promise<Resultado>) => iniciar(async () => { const r = await fn(); setAviso(r); });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/subcuenta/${subId}/pagos`} aria-label="Volver a facturas" className="rounded p-1 text-tenue hover:bg-superficie-2"><ArrowLeft className="size-5" /></Link>
          <h2 className="text-xl font-semibold text-texto">Factura {f.numero}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e[1]}`}>{e[0]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.estado !== 'borrador' && (
            <a href={enlace} target="_blank" rel="noreferrer" className={estilosBoton.secundario}><ExternalLink className="size-4" /> Ver como cliente</a>
          )}
          {editable && (
            <button type="button" disabled={pendiente} onClick={() => iniciar(async () => { await guardar(); })} className={estilosBoton.secundario}>
              {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
            </button>
          )}
          {f.estado === 'enviada' && porCobrar > 0 && (
            <button type="button" onClick={() => setCobro(true)} className={estilosBoton.secundario}><Wallet className="size-4" /> Registrar cobro</button>
          )}
          {editable && (
            <div ref={cajaEnviar} className="relative">
              <button type="button" disabled={pendiente} onClick={() => setMenuEnviar((v) => !v)} className={estilosBoton.primario}>
                <Send className="size-4" /> {f.estado === 'borrador' ? 'Enviar' : 'Reenviar'} <ChevronDown className="size-4" />
              </button>
              {menuEnviar && (
                <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border bg-superficie p-1 shadow-lg">
                  {([['email', 'Por correo'], ['sms', 'Por SMS'], ['whatsapp', 'Por WhatsApp'], ['ninguno', 'Solo marcar como enviada']] as const).map(([c, texto]) => (
                    <button key={c} type="button" className="block w-full rounded px-3 py-2 text-left text-sm text-[#344054] hover:bg-superficie-2 dark:text-texto-2"
                      onClick={() => { setMenuEnviar(false); iniciar(async () => { if (await guardar()) setAviso(await enviarFactura(subId, f.id, c)); }); }}>
                      {texto}
                    </button>
                  ))}
                  <p className="px-3 pb-2 pt-1 text-xs text-tenue">Se manda el enlace a la factura{cobroOnline ? ', con pago por tarjeta' : ''}.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Aviso estado={aviso} />

      <section className="grid gap-4 rounded-lg border border-borde bg-superficie p-5 md:grid-cols-3">
        <div ref={contactoRef} className="md:col-span-1">
          <span className={etiqueta}>Cliente</span>
          {editable ? <SelectorContacto subId={subId} name="contacto_id" inicial={f.contacto} />
            : <p className="text-sm text-texto">{f.contacto ? `${f.contacto.nombre} ${f.contacto.apellidos}`.trim() || f.contacto.email : '—'}<input type="hidden" name="contacto_id" value={f.contacto_id ?? ''} /></p>}
        </div>
        <label className="block"><span className={etiqueta}>Fecha de emisión</span>
          <input type="date" value={emision} disabled={!editable} onChange={(x) => setEmision(x.target.value)} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Vencimiento</span>
          <input type="date" value={vencimiento} min={emision} disabled={!editable} onChange={(x) => setVencimiento(x.target.value)} className={estiloInput} /></label>
      </section>

      <section className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-superficie-2 text-left text-xs text-[#475467]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Concepto</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">Cantidad</th>
              <th className="w-32 px-3 py-2.5 text-right font-medium">Precio</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">Impuesto %</th>
              <th className="w-32 px-3 py-2.5 text-right font-medium">Importe</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i} className="border-t border-borde align-top">
                <td className="px-3 py-2">
                  <input value={l.descripcion} disabled={!editable} list={`productos-${f.id}`} maxLength={500} placeholder="Descripción o producto"
                    onChange={(x) => {
                      const p = productos.find((pr) => pr.nombre === x.target.value);
                      poner(i, p ? { descripcion: p.nombre, precio: p.precio, impuesto: p.impuesto, producto_id: p.id } : { descripcion: x.target.value, producto_id: null });
                    }} className={`${estiloInputBase} w-full`} />
                </td>
                <td className="px-3 py-2"><input type="number" min={0.01} step="any" value={l.cantidad} disabled={!editable} onChange={(x) => poner(i, { cantidad: Number(x.target.value) })} className={`${estiloInputBase} w-full text-right`} /></td>
                <td className="px-3 py-2"><input type="number" min={0} step="0.01" value={l.precio} disabled={!editable} onChange={(x) => poner(i, { precio: Number(x.target.value) })} className={`${estiloInputBase} w-full text-right`} /></td>
                <td className="px-3 py-2"><input type="number" min={0} max={100} step="any" value={l.impuesto} disabled={!editable} onChange={(x) => poner(i, { impuesto: Number(x.target.value) })} className={`${estiloInputBase} w-full text-right`} /></td>
                <td className="px-3 py-3.5 text-right font-medium text-texto">{din((Number(l.cantidad) || 0) * (Number(l.precio) || 0))}</td>
                <td className="px-1 py-2">
                  {editable && <button type="button" aria-label="Quitar línea" onClick={() => setLineas((x) => x.filter((_, j) => j !== i))} className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id={`productos-${f.id}`}>{productos.map((p) => <option key={p.id} value={p.nombre}>{din(p.precio)}</option>)}</datalist>
        <div className="flex flex-wrap items-start justify-between gap-4 border-t border-borde p-4">
          {editable ? (
            <button type="button" onClick={() => setLineas((l) => [...l, { producto_id: null, descripcion: '', cantidad: 1, precio: 0, impuesto: impuestoDefecto }])}
              className={`${estilosBoton.fantasma} text-primario-texto`}><Plus className="size-4" /> Añadir línea</button>
          ) : <span />}
          <dl className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-tenue">Subtotal</dt><dd>{din(t.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-tenue">Impuestos</dt><dd>{din(t.impuestos)}</dd></div>
            <div className="flex justify-between border-t border-borde pt-2 text-base font-semibold text-texto"><dt>Total</dt><dd>{din(t.total)}</dd></div>
            {Number(f.cobrado) > 0 && <div className="flex justify-between text-[#067647]"><dt>Cobrado</dt><dd>{din(Number(f.cobrado))}</dd></div>}
          </dl>
        </div>
      </section>

      <label className="block">
        <span className={etiqueta}>Notas para el cliente</span>
        <textarea value={notas} disabled={!editable} onChange={(x) => setNotas(x.target.value)} rows={3} maxLength={5000} placeholder="Forma de pago, IBAN, condiciones…" className={estiloArea} />
      </label>

      {f.estado !== 'borrador' && (
        <section className="rounded-lg border border-borde bg-superficie p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-texto">Cobros</h3>
            <div className="flex items-center gap-1 text-sm text-tenue">Enlace de la factura <BotonCopiar texto={enlace} /></div>
          </div>
          {cobros.length === 0 ? <p className="text-sm text-tenue">Todavía no hay cobros.{!cobroOnline && ' Configura Stripe en Pagos → Configuración para que el cliente pueda pagar con tarjeta.'}</p> : (
            <ul className="divide-y divide-borde text-sm">
              {cobros.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className={`font-medium ${c.estado === 'reembolsada' ? 'text-tenue line-through' : 'text-texto'}`}>{din(Number(c.importe))}</span>
                  <span className="text-tenue">{NOMBRE_METODO[c.metodo]}</span>
                  <span className="text-tenue">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: zona }).format(new Date(c.fecha))}</span>
                  {c.referencia && <span className="truncate text-xs text-tenue">{c.referencia}</span>}
                  {c.estado === 'reembolsada' ? <span className="ml-auto text-xs text-tenue">Reembolsado</span> : soyAdmin && (
                    <button type="button" className="ml-auto text-xs font-medium text-peligro hover:underline"
                      onClick={() => confirm('¿Marcar este cobro como reembolsado?') && accion(() => reembolsarCobro(subId, c.id))}>Marcar reembolso</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-borde pt-4">
        {f.estado === 'borrador' && (
          <button type="button" className={`${estilosBoton.fantasma} text-peligro`} onClick={() => confirm('¿Borrar este borrador?') && iniciar(async () => {
            const r = await borrarFactura(subId, f.id);
            if (r.ok) router.push(`/subcuenta/${subId}/pagos`); else setAviso(r);
          })}><Trash2 className="size-4" /> Borrar borrador</button>
        )}
        {(f.estado === 'enviada' || f.estado === 'pagada') && (
          <button type="button" className={`${estilosBoton.fantasma} text-peligro`}
            onClick={() => confirm(`¿Anular la factura ${f.numero}? No se puede deshacer; el número queda reservado.`) && accion(() => cambiarEstadoFactura(subId, f.id, 'anulada'))}>
            <Ban className="size-4" /> Anular factura
          </button>
        )}
      </div>

      <Modal abierto={cobro} alCerrar={cerrarCobro} titulo={`Registrar cobro · ${f.numero}`} ancho="max-w-md">
        {cobro && <FormularioCobro subId={subId} facturaId={f.id} pendiente={porCobrar} alGuardar={cerrarCobro} />}
      </Modal>
    </div>
  );
}
