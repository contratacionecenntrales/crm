import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { crearClienteServidor } from '@/lib/supabase/server';
import { esAdminPlataforma } from '@/lib/sesion';
import { FormularioOnboarding } from './Formulario';

export const metadata = { title: 'Crea tu agencia' };

// Si la plataforma tiene el alta cerrada, se explica en vez del formulario.
export default async function PaginaOnboarding() {
  const supabase = await crearClienteServidor();
  const [{ data: a }, admin] = await Promise.all([
    supabase.from('plataforma_ajustes').select('nombre, registro_abierto').eq('id', true).maybeSingle(),
    esAdminPlataforma(),
  ]);
  if (a?.registro_abierto || admin) return <FormularioOnboarding />;
  return (
    <MarcoAcceso titulo="Tu cuenta aún no tiene agencia" subtitulo={`Las agencias las da de alta ${a?.nombre ?? 'la plataforma'}.`}>
      <p className="text-sm text-texto-2">Si has contratado un plan, en cuanto activen tu agencia podrás entrar con este mismo correo. Si te han invitado a una subcuenta, pide a quien te invitó que revise el acceso.</p>
      <form action="/auth/salir" method="post" className="mt-6 text-center">
        <button className="text-sm text-tenue hover:underline">Cerrar sesión</button>
      </form>
    </MarcoAcceso>
  );
}
