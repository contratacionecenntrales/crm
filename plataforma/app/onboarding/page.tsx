'use client';
import { useActionState } from 'react';
import { crearAgencia } from './acciones';
import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { MONEDAS, ZONAS_HORARIAS } from '@/lib/opciones';

export default function PaginaOnboarding() {
  const [estado, accion] = useActionState(crearAgencia, null);
  return (
    <MarcoAcceso titulo="Crea tu agencia" subtitulo="Es el espacio desde el que gestionarás todas tus subcuentas.">
      <form action={accion} className="space-y-4">
        <Campo etiqueta="Nombre de la agencia" name="nombre" required minLength={2} maxLength={120} />
        <Selector etiqueta="Moneda" name="moneda" defaultValue="EUR" opciones={MONEDAS} />
        <Selector etiqueta="Zona horaria" name="zona_horaria" defaultValue="Europe/Madrid" opciones={ZONAS_HORARIAS} />
        <Aviso estado={estado} />
        <BotonEnvio className="w-full">Crear agencia</BotonEnvio>
      </form>
      <form action="/auth/salir" method="post" className="mt-4 text-center">
        <button className="text-sm text-tenue hover:underline">Cerrar sesión</button>
      </form>
    </MarcoAcceso>
  );
}
