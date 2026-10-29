import Link from 'next/link';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { FormularioSubcuenta } from '@/components/agencia/FormularioSubcuenta';
import { Equipo } from '@/components/ui/Equipo';
import { Insignia } from '@/components/ui/Insignia';
import { agregarMiembroSubcuenta, cambiarRolSubcuenta, guardarPerfil, quitarMiembroSubcuenta } from '../acciones';
import type { Miembro, RolSubcuenta } from '@/lib/tipos';

export const metadata = { title: 'Configuración' };

const ROLES: { valor: RolSubcuenta; texto: string }[] = [
  { valor: 'admin', texto: 'Administrador' },
  { valor: 'usuario', texto: 'Usuario' },
];

export default async function ConfiguracionSubcuenta({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string }>;
}) {
  const { id } = await params;
  const { pestana = 'perfil' } = await searchParams;
  const usuario = await usuarioActual();
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);

  const pestanas = [
    { clave: 'perfil', texto: 'Perfil de empresa' },
    { clave: 'equipo', texto: 'Mi equipo' },
  ];

  let miembros: Miembro<RolSubcuenta>[] = [];
  if (pestana === 'equipo') {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc('miembros_subcuenta', { p_subcuenta: id });
    if (error) throw new Error(error.message);
    miembros = (data ?? []) as Miembro<RolSubcuenta>[];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <Insignia tono={soyAdmin ? 'azul' : 'gris'}>{soyAdmin ? 'Administrador' : 'Usuario'}</Insignia>
      </div>
      <nav className="mt-4 flex gap-6 border-b" aria-label="Secciones">
        {pestanas.map((p) => (
          <Link
            key={p.clave}
            href={`?pestana=${p.clave}`}
            aria-current={pestana === p.clave ? 'page' : undefined}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium ${pestana === p.clave ? 'border-primario text-primario' : 'border-transparent text-tenue hover:text-texto'}`}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {pestana === 'equipo' ? (
          <Equipo
            miembros={miembros}
            roles={ROLES}
            yo={usuario.id}
            puedeGestionar={soyAdmin}
            extra={{ subcuenta_id: id }}
            agregar={agregarMiembroSubcuenta}
            cambiarRol={cambiarRolSubcuenta.bind(null, id)}
            quitar={quitarMiembroSubcuenta.bind(null, id)}
          />
        ) : soyAdmin ? (
          <div className="rounded-xl border bg-superficie p-5 shadow-sm">
            <FormularioSubcuenta subcuenta={subcuenta} guardar={guardarPerfil} conEtapa={false} />
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 rounded-xl border bg-superficie p-5 text-sm shadow-sm sm:grid-cols-2">
            {[
              ['Nombre', subcuenta.nombre],
              ['Correo', subcuenta.email ?? '—'],
              ['Teléfono', subcuenta.telefono ? `${subcuenta.prefijo} ${subcuenta.telefono}` : '—'],
              ['Web', subcuenta.web || '—'],
              ['Dirección', [subcuenta.direccion, subcuenta.codigo_postal, subcuenta.ciudad].filter(Boolean).join(', ') || '—'],
              ['Zona horaria', subcuenta.zona_horaria],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-tenue">{k}</dt>
                <dd className="mt-1 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
