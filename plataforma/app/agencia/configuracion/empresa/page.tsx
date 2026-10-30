import { Copy } from 'lucide-react';
import { exigirAgencia } from '@/lib/sesion';
import { ContenedorAjustes, PestanasAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { Avanzada, Basicos, MarcaBlanca } from '@/components/ajustes/Empresa';

export const metadata = { title: 'Configuración de la empresa' };

export default async function PaginaEmpresa({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { actual } = await exigirAgencia({ admin: true });
  const { tab = 'basicos' } = await searchParams;
  const a = actual.agencia;
  const corto = a.id.replace(/-/g, '').slice(0, 9).toUpperCase();
  const relacion = `${corto.slice(0, 3)}-${corto.slice(3, 6)}-${corto.slice(6)}`;
  return (
    <ContenedorAjustes>
      <TituloAjustes titulo="Configuración de la empresa" />
      <PestanasAjustes
        actual={tab}
        pestanas={[
          { clave: 'basicos', texto: 'Detalles básicos', href: '?tab=basicos' },
          { clave: 'marca', texto: 'Marca Blanca', href: '?tab=marca' },
          { clave: 'avanzada', texto: 'Configuración avanzada', href: '?tab=avanzada' },
        ]}
      />
      {tab === 'basicos' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-texto">Detalles básicos</h2>
            <p className="flex items-center gap-2 text-sm text-texto">Número de relación <span className="text-tenue">{relacion}</span><Copy className="size-4 text-tenue" aria-hidden /></p>
          </div>
          <Basicos agencia={a} />
        </>
      )}
      {tab === 'marca' && (<><h2 className="mb-4 text-lg font-medium text-texto">Marca Blanca</h2><MarcaBlanca agencia={a} /></>)}
      {tab === 'avanzada' && (<><h2 className="mb-4 text-lg font-medium text-texto">Configuración avanzada</h2><Avanzada agencia={a} /></>)}
    </ContenedorAjustes>
  );
}
