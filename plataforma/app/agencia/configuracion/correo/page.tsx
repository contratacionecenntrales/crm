import { exigirAgencia } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ContenedorAjustes, PestanasAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesCorreo } from '@/components/ajustes/Canales';
import { TablaCorreoSubcuentas } from '@/components/ajustes/ServiciosAgencia';
import { serviciosAgencia } from '@/lib/conversaciones/agencia';

export const metadata = { title: 'Servicios de correo electrónico' };

export default async function PaginaCorreoAgencia({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { actual } = await exigirAgencia({ admin: true });
  const { tab = 'smtp' } = await searchParams;
  const { ajustes, puestos, filas } = await serviciosAgencia(actual.agencia.id);
  return (
    <ContenedorAjustes>
      <TituloAjustes titulo="Servicios de correo electrónico" />
      <PestanasAjustes actual={tab} pestanas={[
        { clave: 'smtp', texto: 'Servicio por defecto', href: '?tab=smtp' },
        { clave: 'subcuentas', texto: 'Configuraciones de la subcuenta', href: '?tab=subcuentas' },
      ]} />
      {tab === 'subcuentas' ? (
        <TablaCorreoSubcuentas filas={filas} hayDefecto={Boolean(ajustes.correo_proveedor)} />
      ) : (<>
        <h2 className="text-base font-medium text-texto">Servicio de correo por defecto para la agencia</h2>
        <p className="mb-4 text-sm text-tenue">Lo usan las subcuentas que no tengan su propio proveedor de correo (envíos, confirmaciones y recordatorios).</p>
        <AjustesCorreo subId={null} ajustes={ajustes} puestos={puestos} soyAdmin web={siteUrl()} />
      </>)}
    </ContenedorAjustes>
  );
}
