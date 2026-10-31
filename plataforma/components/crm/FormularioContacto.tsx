'use client';
import { useActionState, useEffect, useMemo } from 'react';
import { Campo as CampoUI, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { CampoPersonalizado } from './CampoPersonalizado';
import type { Campo, Contacto, Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

interface Props {
  accion: (prev: (Resultado & { id?: string }) | null, fd: FormData) => Promise<Resultado & { id?: string }>;
  campos: Campo[];
  asignables: Usuario[];
  contacto?: Contacto;
  alGuardar?: (r: Resultado & { id?: string }) => void;
  conEtiquetas?: boolean;
  compacto?: boolean;
}

export function FormularioContacto({ accion, campos, asignables, contacto: c, alGuardar, conEtiquetas, compacto }: Props) {
  const [estado, enviar] = useActionState(accion, null);
  useEffect(() => {
    if (estado?.ok) alGuardar?.(estado);
  }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render

  const carpetas = useMemo(() => {
    const m = new Map<string, Campo[]>();
    for (const x of campos) m.set(x.carpeta, [...(m.get(x.carpeta) ?? []), x]);
    return [...m.entries()];
  }, [campos]);

  const rejilla = compacto ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2';
  return (
    <form action={enviar} className="space-y-6">
      <section className={rejilla}>
        <CampoUI etiqueta="Nombre" name="nombre" defaultValue={c?.nombre} maxLength={100} />
        <CampoUI etiqueta="Apellidos" name="apellidos" defaultValue={c?.apellidos} maxLength={100} />
        <CampoUI etiqueta="Correo electrónico" name="email" type="email" defaultValue={c?.email ?? ''} />
        <CampoUI etiqueta="Teléfono" name="telefono" type="tel" defaultValue={c?.telefono} ayuda="Sin prefijo se usa el de la subcuenta." />
        <CampoUI etiqueta="Nombre de la empresa" name="empresa" defaultValue={c?.empresa?.nombre ?? ''} maxLength={160} />
        <Selector etiqueta="Tipo de contacto" name="tipo" defaultValue={c?.tipo ?? 'lead'}
          opciones={[{ valor: 'lead', texto: 'Lead' }, { valor: 'cliente', texto: 'Cliente' }]} />
        <CampoUI etiqueta="Fuente de contacto" name="fuente" defaultValue={c?.fuente} maxLength={100} />
        <Selector etiqueta="Propietario" name="propietario_id" defaultValue={c?.propietario_id ?? ''}
          opciones={[{ valor: '', texto: 'Sin asignar' }, ...asignables.map((u) => ({ valor: u.usuario_id, texto: u.nombre || u.email }))]} />
        {conEtiquetas && (
          <CampoUI className={compacto ? '' : 'sm:col-span-2'} etiqueta="Etiquetas" name="etiquetas" placeholder="vip, nuevo" ayuda="Separadas por comas." />
        )}
      </section>

      <details open={!compacto || undefined} className="group">
        <summary className="cursor-pointer select-none text-sm font-semibold">Dirección y otros datos</summary>
        <section className={`${rejilla} mt-4`}>
          <CampoUI className={compacto ? '' : 'sm:col-span-2'} etiqueta="Dirección postal" name="direccion" defaultValue={c?.direccion} maxLength={200} />
          <CampoUI etiqueta="Ciudad" name="ciudad" defaultValue={c?.ciudad} maxLength={100} />
          <CampoUI etiqueta="Provincia" name="provincia" defaultValue={c?.provincia} maxLength={100} />
          <CampoUI etiqueta="Código postal" name="codigo_postal" defaultValue={c?.codigo_postal} maxLength={12} />
          <CampoUI etiqueta="País" name="pais" defaultValue={c?.pais} maxLength={60} />
          <CampoUI etiqueta="Sitio web" name="web" type="url" placeholder="https://" defaultValue={c?.web} />
          <CampoUI etiqueta="Fecha de nacimiento" name="fecha_nacimiento" type="date" defaultValue={c?.fecha_nacimiento ?? ''} />
        </section>
      </details>

      {carpetas.map(([carpeta, lista]) => (
        <details key={carpeta} open className="group">
          <summary className="cursor-pointer select-none text-sm font-semibold">{carpeta}</summary>
          <section className={`${rejilla} mt-4`}>
            {lista.map((campo) => <CampoPersonalizado key={campo.id} campo={campo} valor={c?.campos?.[campo.clave]} />)}
          </section>
        </details>
      ))}

      <Aviso estado={estado} />
      <div className="flex justify-end">
        <BotonEnvio>{c ? 'Guardar cambios' : 'Crear contacto'}</BotonEnvio>
      </div>
    </form>
  );
}
