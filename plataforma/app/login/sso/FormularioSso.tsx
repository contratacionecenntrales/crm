'use client';
import { useActionState } from 'react';
import { entrarConSso } from '../acciones';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';

export function FormularioSso({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState(entrarConSso, null);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Correo de empresa" name="email" type="email" autoComplete="email" required placeholder="nombre@tuempresa.com" />
      <Aviso estado={estado} />
      <BotonEnvio className="w-full">Continuar</BotonEnvio>
    </form>
  );
}
