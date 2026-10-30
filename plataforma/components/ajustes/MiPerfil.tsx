'use client';
import { useActionState } from 'react';
import { cambiarContrasena, cambiarCorreo, guardarPerfil } from '@/app/acciones-perfil';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { SeccionAjuste } from './Piezas';

export function MiPerfil({ nombre, apellidos, telefono, email }: { nombre: string; apellidos: string; telefono: string; email: string }) {
  const [e1, a1] = useActionState(guardarPerfil, null);
  const [e2, a2] = useActionState(cambiarCorreo, null);
  const [e3, a3] = useActionState(cambiarContrasena, null);
  return (
    <>
      <SeccionAjuste titulo="Información personal" descripcion="Tu nombre y teléfono, visibles para tu equipo.">
        <form action={a1} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre *" name="nombre" defaultValue={nombre} required maxLength={60} />
          <Campo etiqueta="Apellidos" name="apellidos" defaultValue={apellidos} maxLength={80} />
          <Campo className="sm:col-span-2" etiqueta="Teléfono" name="telefono" type="tel" defaultValue={telefono} placeholder="+34 600 000 000" />
          <div className="sm:col-span-2"><Aviso estado={e1} /></div>
          <div className="flex justify-end sm:col-span-2"><BotonEnvio>Guardar cambios</BotonEnvio></div>
        </form>
      </SeccionAjuste>
      <SeccionAjuste titulo="Correo electrónico" descripcion="Con él inicias sesión. El cambio se confirma por correo.">
        <form action={a2} className="space-y-4">
          <Campo etiqueta="Correo electrónico" name="email" type="email" defaultValue={email} required />
          <Aviso estado={e2} />
          <div className="flex justify-end"><BotonEnvio variante="secundario">Cambiar correo</BotonEnvio></div>
        </form>
      </SeccionAjuste>
      <SeccionAjuste titulo="Contraseña" descripcion="Mínimo 10 caracteres.">
        <form action={a3} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etiqueta="Contraseña actual" name="actual" type="password" autoComplete="current-password" required />
          <Campo etiqueta="Nueva contraseña" name="nueva" type="password" autoComplete="new-password" minLength={10} required />
          <Campo etiqueta="Repite la nueva" name="repetida" type="password" autoComplete="new-password" minLength={10} required />
          <div className="sm:col-span-3"><Aviso estado={e3} /></div>
          <div className="flex justify-end sm:col-span-3"><BotonEnvio variante="secundario">Cambiar contraseña</BotonEnvio></div>
        </form>
      </SeccionAjuste>
    </>
  );
}
