import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { COLUMNAS_FACTURA, type Factura, type Linea, type Producto, type Transaccion } from '@/lib/pagos/tipos';
import { EditorFactura } from '@/components/pagos/EditorFactura';

export const metadata = { title: 'Factura' };

export default async function PaginaFactura({ params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fid)) notFound();
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [f, lineas, productos, cobros, ajustes, secretos] = await Promise.all([
    supabase.from('pag_facturas').select(COLUMNAS_FACTURA).eq('id', fid).eq('subcuenta_id', id).maybeSingle(),
    supabase.from('pag_lineas').select('id, producto_id, descripcion, cantidad, precio, impuesto').eq('factura_id', fid).order('orden'),
    supabase.from('pag_productos').select('id, nombre, descripcion, precio, impuesto, activo').eq('subcuenta_id', id).eq('activo', true).order('nombre'),
    supabase.from('pag_transacciones').select('id, factura_id, contacto_id, importe, moneda, metodo, referencia, estado, notas, fecha, factura:pag_facturas(numero), contacto:crm_contactos(id, nombre, apellidos, email, telefono)').eq('factura_id', fid).order('fecha'),
    supabase.from('pag_ajustes').select('impuesto_defecto').eq('subcuenta_id', id).maybeSingle(),
    supabase.rpc('pag_estado_secretos', { p_subcuenta: id }),
  ]);
  if (!f.data) notFound();
  return (
    <EditorFactura
      subId={id}
      zona={subcuenta.zona_horaria}
      factura={f.data as unknown as Factura}
      lineas={((lineas.data ?? []) as Linea[]).map((l) => ({ ...l, cantidad: Number(l.cantidad), precio: Number(l.precio), impuesto: Number(l.impuesto) }))}
      productos={((productos.data ?? []) as Producto[]).map((p) => ({ ...p, precio: Number(p.precio), impuesto: Number(p.impuesto) }))}
      cobros={(cobros.data ?? []) as unknown as Transaccion[]}
      impuestoDefecto={Number(ajustes.data?.impuesto_defecto ?? 21)}
      enlace={`${siteUrl()}/factura/${(f.data as { token: string }).token}`}
      cobroOnline={Boolean((secretos.data as { stripe_secreta?: boolean } | null)?.stripe_secreta)}
      soyAdmin={soyAdmin}
    />
  );
}
