import { subcuentaVisible } from '@/lib/sesion';
import { FormularioSubcuenta } from '@/components/agencia/FormularioSubcuenta';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { guardarPerfil } from '../acciones';

export const metadata = { title: 'Perfil de empresa' };

export default async function PerfilEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  return (
    <ContenedorAjustes ancho="max-w-4xl">
      <TituloAjustes titulo="Perfil de empresa" subtitulo={soyAdmin ? 'Los datos del negocio de esta subcuenta.' : 'Solo los administradores pueden editar estos datos.'} />
      <div className="rounded-lg border border-borde bg-superficie p-5">
        {soyAdmin ? (
          <FormularioSubcuenta subcuenta={subcuenta} guardar={guardarPerfil} conEtapa={false} />
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {[['Nombre', subcuenta.nombre], ['Correo', subcuenta.email ?? '—'], ['Teléfono', subcuenta.telefono ? `${subcuenta.prefijo} ${subcuenta.telefono}` : '—'],
              ['Web', subcuenta.web || '—'], ['Dirección', [subcuenta.direccion, subcuenta.codigo_postal, subcuenta.ciudad].filter(Boolean).join(', ') || '—'],
              ['Zona horaria', subcuenta.zona_horaria]].map(([k, v]) => (
              <div key={k}><dt className="text-tenue">{k}</dt><dd className="mt-1 font-medium text-texto">{v}</dd></div>
            ))}
          </dl>
        )}
      </div>
    </ContenedorAjustes>
  );
}
