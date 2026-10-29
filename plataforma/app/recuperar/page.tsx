'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { enviarRecuperacion } from '@/app/login/acciones';
import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';

export default function PaginaRecuperar() {
  const [estado, accion] = useActionState(enviarRecuperacion, null);
  return (
    <MarcoAcceso titulo="Recuperar contraseña" subtitulo="Te enviaremos un enlace para crear una nueva.">
      <form action={accion} className="space-y-4">
        <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
        <Aviso estado={estado} />
        <BotonEnvio className="w-full">Enviar enlace</BotonEnvio>
        <p className="text-center text-sm">
          <Link href="/login" className="text-primario hover:underline">Volver a iniciar sesión</Link>
        </p>
      </form>
    </MarcoAcceso>
  );
}
