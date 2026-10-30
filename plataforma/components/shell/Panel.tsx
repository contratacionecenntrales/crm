import 'server-only';
import { crearClienteServidor } from '@/lib/supabase/server';
import { contextoAgencias, esAdminAgencia, subcuentasVisibles, usuarioActual } from '@/lib/sesion';
import { direccionCompleta } from '@/lib/formato';
import { MarcoPanel } from './MarcoPanel';
import { SelectorSubcuenta } from './SelectorSubcuenta';
import { Campana } from './Campana';
import { MenuUsuario } from './MenuUsuario';
import { AccionesRapidas, Buscador } from './Herramientas';
import { Ayuda, type DatosSoporte } from './Ayuda';
import { Anuncios, CierreInactividad, TemaPorDefecto, type AnuncioVisible } from './Marca';
import type { SeccionAjustes } from './MarcoPanel';
import type { ElementoNav } from './iconos';

interface Props {
  principal: ElementoNav[];
  secundario?: ElementoNav[];
  ajustes?: ElementoNav;
  menuAjustes?: { volver: string; secciones: SeccionAjustes[]; prefijo: string };
  // Subcuenta en la que se está, o null en la vista de agencia.
  subcuentaActual: { id: string; nombre: string; detalle: string; logo_url: string | null } | null;
  children: React.ReactNode;
}

export async function Panel({ principal, secundario, ajustes, menuAjustes, subcuentaActual, children }: Props) {
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  const [{ actual }, subs, avisos, soporte] = await Promise.all([
    contextoAgencias(),
    subcuentasVisibles(),
    supabase
      .from('notificaciones')
      .select('id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace, leida, creado, subcuentas(nombre)')
      .order('creado', { ascending: false })
      .limit(50),
    subcuentaActual ? supabase.rpc('soporte_subcuenta', { p_subcuenta: subcuentaActual.id }) : Promise.resolve({ data: null }),
  ]);
  const anuncios = subcuentaActual
    ? (((await supabase.rpc('anuncios_pendientes', { p_subcuenta: subcuentaActual.id })).data ?? []) as AnuncioVisible[])
    : [];
  // Marca de la agencia: la propia (vista de agencia) o la de la subcuenta.
  const marca = subcuentaActual
    ? (soporte.data as { logo_url: string | null; css: string; tema: 'claro' | 'oscuro'; expiracion: number | null } | null)
    : actual
      ? { logo_url: actual.agencia.logo_url, css: actual.agencia.css_personalizado, tema: actual.agencia.tema_defecto, expiracion: actual.agencia.expiracion_sesion_min }
      : null;

  const opciones = subs
    .filter((s) => !actual || s.agencia_id === actual.agencia.id || !esAdminAgencia(actual.rol))
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: direccionCompleta(s),
      logo_url: s.logo_url,
      fijada: s.fijada,
      suspendida: s.estado === 'suspendida',
    }));

  const cabecera = subcuentaActual ?? {
    nombre: actual?.agencia.nombre ?? 'Mi cuenta',
    detalle: 'Vista de agencia',
    logo_url: actual?.agencia.logo_url ?? null,
  };
  const datosSoporte: DatosSoporte | null = subcuentaActual
    ? ((soporte.data as DatosSoporte | null) ?? null)
    : actual
      ? { agencia: actual.agencia.nombre, email: actual.agencia.email, telefono: actual.agencia.telefono, web: actual.agencia.web, id: actual.agencia.id }
      : null;
  const nombre = String(usuario.user_metadata?.nombre ?? usuario.user_metadata?.full_name ?? '');
  const logoAgencia = marca?.logo_url ?? null;
  const nombreAgencia = actual?.agencia.nombre ?? datosSoporte?.agencia ?? 'Metatok';

  return (
    <MarcoPanel
      principal={principal}
      secundario={secundario}
      ajustes={ajustes}
      menuAjustes={menuAjustes}
      logo={{ url: logoAgencia, nombre: nombreAgencia }}
      selector={<SelectorSubcuenta subcuentas={opciones} actual={cabecera} vistaAgencia={Boolean(actual)} enAgencia={!subcuentaActual} />}
      herramientas={
        <>
          <Buscador
            subId={subcuentaActual?.id}
            paginas={[...principal, ...(secundario ?? []), ...(ajustes ? [ajustes] : [])]}
            cuentas={subcuentaActual ? undefined : opciones.map((o) => ({ id: o.id, nombre: o.nombre }))}
          />
          {subcuentaActual && <AccionesRapidas subId={subcuentaActual.id} />}
        </>
      }
      acciones={
        <>
          <Campana usuarioId={usuario.id} iniciales={(avisos.data ?? []) as never} />
          <Ayuda datos={datosSoporte} />
          <MenuUsuario nombre={nombre} email={usuario.email ?? ''} logo={logoAgencia} />
        </>
      }
    >
      {/* CSS de la agencia: se guarda sin «<», así no puede cerrar la etiqueta. */}
      {marca?.css && <style dangerouslySetInnerHTML={{ __html: marca.css.replace(/</g, '') }} />}
      {marca && <TemaPorDefecto tema={marca.tema} />}
      {marca?.expiracion && <CierreInactividad minutos={marca.expiracion} />}
      <Anuncios anuncios={anuncios} />
      {children}
    </MarcoPanel>
  );
}
