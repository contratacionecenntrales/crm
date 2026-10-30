import { redirect } from 'next/navigation';

// El equipo vive ahora en Configuración → Usuarios, como en el original.
export default function Equipo() {
  redirect('/agencia/configuracion/usuarios');
}
