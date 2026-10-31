'use client';
import { useActionState, useEffect } from 'react';
import { crearSubcuenta, actualizarSubcuenta } from '@/app/agencia/acciones';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { PAISES, ZONAS_HORARIAS } from '@/lib/opciones';
import { ETAPAS, type Resultado, type Subcuenta } from '@/lib/tipos';

interface Props {
  subcuenta?: Subcuenta;
  alTerminar?: () => void;
  // Acción alternativa (p. ej. la del admin de la subcuenta, que no toca la etapa).
  guardar?: (prev: Resultado | null, fd: FormData) => Promise<Resultado>;
  conEtapa?: boolean;
}

export function FormularioSubcuenta({ subcuenta, alTerminar, guardar, conEtapa = true }: Props) {
  const [estado, accion] = useActionState(guardar ?? (subcuenta ? actualizarSubcuenta : crearSubcuenta), null);
  useEffect(() => {
    if (estado?.ok) alTerminar?.();
  }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render

  const s = subcuenta;
  return (
    <form action={accion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Campo className="sm:col-span-2" etiqueta="Nombre del negocio" name="nombre" defaultValue={s?.nombre} required minLength={2} maxLength={120} />
      <Campo etiqueta="Correo electrónico" name="email" type="email" defaultValue={s?.email ?? ''} />
      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <Campo etiqueta="Prefijo" name="prefijo" defaultValue={s?.prefijo ?? '+34'} pattern="^\+\d{1,4}$" required />
        <Campo etiqueta="Teléfono" name="telefono" inputMode="tel" defaultValue={s?.telefono ?? ''} />
      </div>
      <Campo className="sm:col-span-2" etiqueta="Dirección" name="direccion" defaultValue={s?.direccion ?? ''} />
      <Campo etiqueta="Ciudad" name="ciudad" defaultValue={s?.ciudad ?? ''} />
      <Campo etiqueta="Provincia" name="provincia" defaultValue={s?.provincia ?? ''} />
      <Campo etiqueta="Código postal" name="codigo_postal" defaultValue={s?.codigo_postal ?? ''} />
      <Selector etiqueta="País" name="pais" defaultValue={s?.pais ?? 'ES'} opciones={PAISES} />
      <Campo etiqueta="Sitio web" name="web" type="url" placeholder="https://" defaultValue={s?.web ?? ''} />
      <Selector etiqueta="Zona horaria" name="zona_horaria" defaultValue={s?.zona_horaria ?? 'Europe/Madrid'} opciones={ZONAS_HORARIAS} />
      {conEtapa && (
        <Selector className="sm:col-span-2" etiqueta="Etapa del cliente" name="etapa" defaultValue={s?.etapa ?? 'Cerrado (Ganado)'}
          opciones={ETAPAS.map((e) => ({ valor: e, texto: e }))} />
      )}
      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <BotonEnvio>{s ? 'Guardar cambios' : 'Crear subcuenta'}</BotonEnvio>
      </div>
    </form>
  );
}
