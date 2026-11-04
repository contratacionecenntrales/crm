import { exigirAgencia } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ContenedorAjustes, PestanasAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { AjustesTwilio } from '@/components/ajustes/Canales';
import { TablaTelefoniaSubcuentas } from '@/components/ajustes/ServiciosAgencia';
import { serviciosAgencia } from '@/lib/conversaciones/agencia';

export const metadata = { title: 'Integración telefónica' };

export default async function PaginaTelefoniaAgencia({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { actual } = await exigirAgencia({ admin: true });
  const { tab = 'subcuentas' } = await searchParams;
  const { ajustes, puestos, filas } = await serviciosAgencia(actual.agencia.id);
  return (
    <ContenedorAjustes>
      <TituloAjustes titulo="Integración telefónica" />
      <PestanasAjustes actual={tab} pestanas={[
        { clave: 'agencia', texto: 'Configuración de la agencia', href: '?tab=agencia' },
        { clave: 'subcuentas', texto: 'Sub Cuenta Configuración', href: '?tab=subcuentas' },
      ]} />
      {tab === 'agencia' ? (<>
        <h2 className="text-base font-medium text-texto">Cuenta de Twilio de la agencia</h2>
        <p className="mb-4 text-sm text-tenue">Las subcuentas sin cuenta de Twilio propia enviarán SMS y WhatsApp con esta, desde sus propios números.</p>
        <AjustesTwilio subId={null} ajustes={ajustes} tokenPuesto={puestos.twilio_token} soyAdmin web={siteUrl()} />
      </>) : (
        <TablaTelefoniaSubcuentas filas={filas} sidAgencia={ajustes.twilio_sid} tokenAgencia={puestos.twilio_token} />
      )}
    </ContenedorAjustes>
  );
}
