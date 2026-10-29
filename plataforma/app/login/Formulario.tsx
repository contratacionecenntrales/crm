'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { iniciarSesion } from './acciones';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';

export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState(iniciarSesion, null);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
      <Campo etiqueta="Contraseña" name="clave" type="password" autoComplete="current-password" required />
      <Aviso estado={estado} />
      <BotonEnvio className="w-full">Iniciar sesión</BotonEnvio>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="text-primario hover:underline">
          ¿Has olvidado la contraseña?
        </Link>
      </p>
    </form>
  );
}
