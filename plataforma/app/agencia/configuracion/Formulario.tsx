'use client';
import { useActionState } from 'react';
import { actualizarAgencia } from '../acciones';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { MONEDAS, ZONAS_HORARIAS } from '@/lib/opciones';
import type { Agencia } from '@/lib/tipos';

export function FormularioAgencia({ agencia }: { agencia: Agencia }) {
  const [estado, accion] = useActionState(actualizarAgencia, null);
  return (
    <form action={accion} className="grid grid-cols-1 gap-4 rounded-xl border bg-superficie p-5 shadow-sm sm:grid-cols-2">
      <Campo className="sm:col-span-2" etiqueta="Nombre de la agencia" name="nombre" defaultValue={agencia.nombre} required minLength={2} maxLength={120} />
      <Campo etiqueta="Correo de contacto" name="email" type="email" defaultValue={agencia.email ?? ''} />
      <Campo etiqueta="Teléfono" name="telefono" defaultValue={agencia.telefono} />
      <Campo className="sm:col-span-2" etiqueta="Sitio web" name="web" type="url" placeholder="https://" defaultValue={agencia.web} />
      <Selector etiqueta="Moneda" name="moneda" defaultValue={agencia.moneda} opciones={MONEDAS} />
      <Selector etiqueta="Zona horaria" name="zona_horaria" defaultValue={agencia.zona_horaria} opciones={ZONAS_HORARIAS} />
      <div className="sm:col-span-2"><Aviso estado={estado} /></div>
      <div className="flex justify-end sm:col-span-2"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
