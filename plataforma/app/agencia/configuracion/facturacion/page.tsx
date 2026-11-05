import { Check, X } from 'lucide-react';
import { exigirAgencia, miPlan } from '@/lib/sesion';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { Insignia } from '@/components/ui/Insignia';
import { dinero, fecha } from '@/lib/formato';
import { FUNCIONES } from '@/lib/plataforma';

export const metadata = { title: 'Facturación' };

function Barra({ usado, max, texto }: { usado: number; max: number | null; texto: string }) {
  const pct = max ? Math.min(100, (usado / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-texto-2">{texto}</span><span className="font-medium text-texto">{usado}{max !== null ? ` de ${max}` : ' (sin límite)'}</span></div>
      {max !== null && <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-superficie-2"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-peligro' : pct > 80 ? 'bg-aviso' : 'bg-primario'}`} style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

export default async function PaginaFacturacion() {
  const { actual } = await exigirAgencia({ admin: true });
  const p = await miPlan(actual.agencia.id);
  const dias = p?.prueba_hasta ? Math.ceil((Date.parse(p.prueba_hasta + 'T23:59:59') - Date.now()) / 864e5) : null;
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Tablero de facturación" subtitulo={`Tu plan con ${p?.plataforma ?? 'la plataforma'} y lo que estás usando.`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-borde bg-superficie p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-tenue">Plan actual</p>
              <h2 className="text-2xl font-semibold text-texto">{p?.plan?.nombre ?? 'Sin plan asignado'}</h2>
              {p?.plan?.descripcion && <p className="mt-1 text-sm text-tenue">{p.plan.descripcion}</p>}
            </div>
            {p?.plan && <p className="text-right"><span className="text-3xl font-semibold text-texto">{dinero(p.plan.precio, p.plan.moneda)}</span><span className="block text-xs text-tenue">por mes</span></p>}
          </div>
          <div className="mt-4">
            {p?.estado === 'activa' && <Insignia tono="verde">Activa</Insignia>}
            {p?.estado === 'prueba' && <Insignia tono={p.operativa ? 'azul' : 'rojo'}>{p.operativa ? `Prueba: ${dias} día(s) restantes (hasta el ${fecha(p.prueba_hasta)})` : 'Prueba terminada'}</Insignia>}
            {p?.estado === 'suspendida' && <Insignia tono="rojo">Suspendida{p.motivo ? `: ${p.motivo}` : ''}</Insignia>}
          </div>
          <div className="mt-6 space-y-4">
            <Barra usado={p?.subcuentas ?? 0} max={p?.plan?.max_subcuentas ?? null} texto="Subcuentas" />
            <Barra usado={p?.usuarios ?? 0} max={p?.plan?.max_usuarios ?? null} texto="Usuarios" />
          </div>
          <p className="mt-6 rounded-md bg-superficie-2 px-4 py-3 text-sm text-texto-2">¿Necesitas más subcuentas o usuarios, o quieres cambiar de plan? Contacta con {p?.plataforma ?? 'la plataforma'}: el cambio se aplica al momento.</p>
        </section>
        <aside className="rounded-lg border border-borde bg-superficie p-6">
          <h3 className="font-medium text-texto">Incluido en tu plan</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {FUNCIONES.map(([k, t]) => {
              const si = !p?.plan || Boolean(p.plan.funciones?.[k]);
              return <li key={k} className={`flex items-center gap-2 ${si ? 'text-texto' : 'text-tenue line-through'}`}>{si ? <Check className="size-4 text-exito" /> : <X className="size-4" />}{t}</li>;
            })}
          </ul>
        </aside>
      </div>
    </ContenedorAjustes>
  );
}
