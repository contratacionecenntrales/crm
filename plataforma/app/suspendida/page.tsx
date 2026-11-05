import Link from 'next/link';
import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { contextoAgencias, miPlan } from '@/lib/sesion';
import { fecha } from '@/lib/formato';

export const metadata = { title: 'Acceso suspendido' };

// Se llega aquí al intentar entrar en una subcuenta de una agencia suspendida
// o con la prueba vencida.
export default async function PaginaSuspendida() {
  const { membresias } = await contextoAgencias();
  const planes = await Promise.all(membresias.map(async (m) => ({ m, p: await miPlan(m.agencia.id) })));
  const bloqueadas = planes.filter(({ p }) => p && !p.operativa);
  return (
    <MarcoAcceso titulo="Acceso suspendido" subtitulo="Las subcuentas de esta agencia no están disponibles ahora mismo.">
      {bloqueadas.length ? bloqueadas.map(({ m, p }) => (
        <div key={m.agencia.id} className="mb-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] p-4 text-sm text-[#b42318] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">{m.agencia.nombre}</p>
          <p className="mt-1">{p!.estado === 'prueba' ? `El periodo de prueba terminó el ${fecha(p!.prueba_hasta)}.` : p!.motivo || 'La agencia está suspendida.'}</p>
          <p className="mt-1 text-[#912018] dark:text-red-200">Para reactivarla, contacta con {p!.plataforma}.</p>
        </div>
      )) : (
        <p className="mb-4 text-sm text-tenue">La agencia que gestiona esta cuenta la tiene suspendida temporalmente. Ponte en contacto con ella.</p>
      )}
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/" className="font-medium text-primario-texto hover:underline">Volver al inicio</Link>
        <form action="/auth/salir" method="post"><button className="text-tenue hover:underline">Cerrar sesión</button></form>
      </div>
    </MarcoAcceso>
  );
}
