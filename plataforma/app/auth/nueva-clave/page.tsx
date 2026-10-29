'use client';
import { useActionState } from 'react';
import { cambiarClave } from '@/app/login/acciones';
import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';

export default function PaginaNuevaClave() {
  const [estado, accion] = useActionState(cambiarClave, null);
  return (
    <MarcoAcceso titulo="Crea tu contraseña" subtitulo="Mínimo 10 caracteres.">
      <form action={accion} className="space-y-4">
        <Campo etiqueta="Nueva contraseña" name="clave" type="password" autoComplete="new-password" minLength={10} required />
        <Campo etiqueta="Repite la contraseña" name="repetida" type="password" autoComplete="new-password" minLength={10} required />
        <Aviso estado={estado} />
        <BotonEnvio className="w-full">Guardar y entrar</BotonEnvio>
      </form>
    </MarcoAcceso>
  );
}
