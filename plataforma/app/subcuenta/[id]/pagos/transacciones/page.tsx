import Link from 'next/link';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { dinero } from '@/lib/formato';
import { nombreContacto } from '@/lib/crm/tipos';
import { NOMBRE_METODO, type Transaccion } from '@/lib/pagos/tipos';
import { BotonCobroSuelto } from '@/components/pagos/Transacciones';

export const metadata = { title: 'Transacciones' };

export default async function PaginaTransacciones({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('pag_transacciones')
    .select('id, factura_id, contacto_id, importe, moneda, metodo, referencia, estado, notas, fecha, factura:pag_facturas(numero), contacto:crm_contactos(id, nombre, apellidos, email, telefono)')
    .eq('subcuenta_id', id).order('fecha', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const lista = (data ?? []) as unknown as Transaccion[];
  const f = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: subcuenta.zona_horaria });
  return (
    <div className="space-y-4 p-4 font-sans">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-texto">Transacciones</h2><BotonCobroSuelto subId={id} /></div>
      <div className="overflow-x-auto rounded-lg border border-borde-fuerte bg-superficie">
        <table className="w-full min-w-[820px] text-left text-[13px] text-[#475467] dark:text-texto-2">
          <thead className="bg-superficie-2 text-xs"><tr>{['Fecha', 'Importe', 'Método', 'Factura', 'Contacto', 'Referencia', 'Estado'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">Todavía no hay cobros.</td></tr>}
            {lista.map((t) => (
              <tr key={t.id} className="border-t border-borde-fuerte">
                <td className="px-4 py-2.5">{f.format(new Date(t.fecha))}</td>
                <td className={`px-4 py-2.5 font-medium ${t.estado === 'reembolsada' ? 'text-tenue line-through' : 'text-texto'}`}>{dinero(Number(t.importe), t.moneda)}</td>
                <td className="px-4 py-2.5">{NOMBRE_METODO[t.metodo]}</td>
                <td className="px-4 py-2.5">{t.factura_id && t.factura ? <Link href={`/subcuenta/${id}/pagos/facturas/${t.factura_id}`} className="text-primario-texto hover:underline">{t.factura.numero}</Link> : '—'}</td>
                <td className="px-4 py-2.5">{t.contacto ? <Link href={`/subcuenta/${id}/contacto/${t.contacto.id}`} className="hover:underline">{nombreContacto(t.contacto)}</Link> : '—'}</td>
                <td className="max-w-[200px] truncate px-4 py-2.5">{t.referencia || '—'}</td>
                <td className="px-4 py-2.5">{t.estado === 'completada' ? <span className="rounded-full bg-[#dcfae6] px-2.5 py-0.5 text-xs font-medium text-[#067647]">Completada</span> : <span className="rounded-full bg-[#f2f4f7] px-2.5 py-0.5 text-xs font-medium text-[#344054]">Reembolsada</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
