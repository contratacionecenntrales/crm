import { usuarioActual } from '@/lib/sesion';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { MiPerfil } from '@/components/ajustes/MiPerfil';

export const metadata = { title: 'Mi perfil' };

export default async function PaginaPerfil() {
  const u = await usuarioActual();
  const m = u.user_metadata ?? {};
  return (
    <ContenedorAjustes>
      <TituloAjustes titulo="Mi perfil" subtitulo="Tus datos personales y de acceso." />
      <MiPerfil nombre={String(m.nombre_pila ?? m.nombre ?? '')} apellidos={String(m.apellidos ?? '')} telefono={String(m.telefono ?? '')} email={u.email ?? ''} />
    </ContenedorAjustes>
  );
}
