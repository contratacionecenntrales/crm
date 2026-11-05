import { Panel } from '@/components/shell/Panel';
import Link from 'next/link';
import { esAdminAgencia, exigirAgencia, miPlan } from '@/lib/sesion';
import { fecha } from '@/lib/formato';
import type { ElementoNav } from '@/components/shell/iconos';

export default async function LayoutAgencia({ children }: { children: React.ReactNode }) {
  const { actual } = await exigirAgencia();
  const admin = esAdminAgencia(actual.rol);
  const principal: ElementoNav[] = [
    ...(admin ? [{ href: '/agencia', etiqueta: 'Tablero de la agencia', icono: 'tableroAgencia', exacto: true } as const] : []),
    { href: '/agencia/subcuentas', etiqueta: 'Subcuentas', icono: 'subcuentas' },
  ];
  const c = '/agencia/configuracion';
  const menuAjustes = {
    volver: '/agencia',
    prefijo: c,
    secciones: [{
      elementos: [
        { href: `${c}/perfil`, etiqueta: 'Mi perfil' },
        { href: `${c}/empresa`, etiqueta: 'Empresa' },
        { href: `${c}/usuarios`, etiqueta: 'Usuarios' },
        { href: `${c}/facturacion`, etiqueta: 'Facturación' },
        { href: `${c}/telefonia`, etiqueta: 'Integración telefónica' },
        { href: `${c}/correo`, etiqueta: 'Servicios de correo electrónico' },
        { href: `${c}/anuncios`, etiqueta: 'Anuncios', nueva: true },
        { href: `${c}/enlaces`, etiqueta: 'Enlaces de menú personalizados', nueva: true },
        { href: `${c}/stripe`, etiqueta: 'Stripe' },
        { href: `${c}/claves-api`, etiqueta: 'Claves de API' },
        { href: `${c}/auditoria`, etiqueta: 'Registros de auditoría' },
        { href: `${c}/multimedia`, etiqueta: 'Uso de contenido multimedia' },
      ],
    }],
  };
  const ajustes: ElementoNav | undefined = admin ? { href: '/agencia/configuracion/empresa', etiqueta: 'Configuración', icono: 'ajustes', tambien: ['/agencia/configuracion'] } : undefined;

  // Aviso de prueba (últimos 7 días) o de agencia suspendida.
  const plan = await miPlan(actual.agencia.id);
  const dias = plan?.prueba_hasta ? Math.ceil((Date.parse(plan.prueba_hasta + 'T23:59:59') - Date.now()) / 864e5) : null;
  const aviso = !plan ? null
    : !plan.operativa ? { tono: 'rojo', texto: plan.estado === 'prueba' ? `Tu periodo de prueba terminó el ${fecha(plan.prueba_hasta)}: las subcuentas no están disponibles.` : `Agencia suspendida${plan.motivo ? `: ${plan.motivo}` : ''}. Las subcuentas no están disponibles.` }
    : plan.estado === 'prueba' && dias !== null && dias <= 7 ? { tono: 'ambar', texto: `Te quedan ${dias} día(s) de prueba (hasta el ${fecha(plan.prueba_hasta)}).` } : null;
  return (
    <Panel principal={principal} ajustes={ajustes} menuAjustes={admin ? menuAjustes : undefined} subcuentaActual={null}>
      {aviso && (
        <div role="alert" className={`mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${aviso.tono === 'rojo' ? 'border-[#fda29b] bg-[#fef3f2] text-[#b42318] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' : 'border-[#fec84b] bg-[#fffaeb] text-[#b54708] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>
          <span className="flex-1">{aviso.texto} Contacta con {plan?.plataforma} para {plan?.operativa ? 'seguir sin cortes' : 'reactivarla'}.</span>
          {admin && <Link href="/agencia/configuracion/facturacion" className="font-medium underline">Ver mi plan</Link>}
        </div>
      )}
      {children}
    </Panel>
  );
}
