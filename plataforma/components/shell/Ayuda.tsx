'use client';
import { useState } from 'react';
import { Copy, Globe, Mail, Phone, X } from 'lucide-react';

export interface DatosSoporte {
  agencia: string;
  email: string | null;
  telefono: string;
  web: string;
  id: string;
}

// Panel «Ayuda y asistencia» con los datos de contacto reales de la agencia.
export function Ayuda({ datos }: { datos: DatosSoporte | null }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const corto = datos ? datos.id.replace(/-/g, '').slice(0, 9).toUpperCase() : '';
  const relacion = corto ? `${corto.slice(0, 3)}-${corto.slice(3, 6)}-${corto.slice(6, 9)}` : '';
  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Ayuda y asistencia" className="inline-flex size-8 items-center justify-center rounded-full bg-[#188bf6] text-sm font-bold text-white">?</button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 font-sans" onClick={() => setAbierto(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-superficie shadow-2xl">
            <div className="flex items-start justify-between p-6 pb-3">
              <div>
                <h2 className="text-2xl font-medium text-texto-2">Ayuda y asistencia</h2>
                <p className="mt-2 text-sm text-tenue">Si necesitas ayuda, ponte en contacto con el equipo de {datos?.agencia ?? 'tu agencia'}.</p>
              </div>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-tenue"><X className="size-6" /></button>
            </div>
            {datos ? (
              <div className="space-y-4 px-6 pb-6">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Número de relación</span>
                  <span className="text-tenue">{relacion}</span>
                  <button aria-label="Copiar número" onClick={() => { void navigator.clipboard?.writeText(relacion); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                    className="text-tenue hover:text-texto"><Copy className="size-4" /></button>
                  {copiado && <span className="text-xs text-exito">Copiado</span>}
                </p>
                <ul className="divide-y rounded-lg border">
                  {datos.email && (
                    <li><a href={`mailto:${datos.email}?subject=${encodeURIComponent('Solicitud de soporte · ' + relacion)}`} className="flex items-center gap-4 p-4 hover:bg-superficie-2">
                      <Mail className="size-6 text-primario" /><span><span className="block font-medium">Escríbenos</span><span className="text-sm text-tenue">{datos.email}</span></span></a></li>
                  )}
                  {datos.telefono && (
                    <li><a href={`tel:${datos.telefono.replace(/\s/g, '')}`} className="flex items-center gap-4 p-4 hover:bg-superficie-2">
                      <Phone className="size-6 text-primario" /><span><span className="block font-medium">Llámanos</span><span className="text-sm text-tenue">{datos.telefono}</span></span></a></li>
                  )}
                  {datos.web && (
                    <li><a href={datos.web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 hover:bg-superficie-2">
                      <Globe className="size-6 text-primario" /><span><span className="block font-medium">Visita nuestra web</span><span className="text-sm text-tenue">{datos.web}</span></span></a></li>
                  )}
                </ul>
                {!datos.email && !datos.telefono && !datos.web && (
                  <p className="text-sm text-tenue">La agencia aún no ha rellenado sus datos de contacto (Agencia → Configuración).</p>
                )}
              </div>
            ) : (
              <p className="px-6 text-sm text-tenue">No hay datos de soporte disponibles.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
