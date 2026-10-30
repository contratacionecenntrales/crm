'use client';
import { useActionState } from 'react';
import { CalendarCheck, CalendarX2, Clock, MapPin } from 'lucide-react';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { estiloArea, estilosBoton } from '@/components/ui/clases';
import { diaEn, fechaLarga, horaEn } from '@/lib/calendario/tiempo';
import { cancelarCitaPublica } from './acciones';

export interface CitaPublica {
  titulo: string; inicio: string; fin: string; estado: string; zona_horaria: string; ubicacion: string;
  empresa: string; logo_url: string | null; slug: string | null; puede_cancelar: boolean;
}

export function CancelarCita({ token, cita: c }: { token: string; cita: CitaPublica }) {
  const [estado, accion] = useActionState(cancelarCitaPublica.bind(null, token), null);
  const cancelada = c.estado === 'cancelada' || estado?.ok;
  const pasada = Date.parse(c.inicio) <= Date.now();
  const ini = new Date(c.inicio);
  return (
    <div className="w-full max-w-md self-start rounded-xl border border-borde bg-white p-8 text-[#101828] shadow-sm">
      {c.logo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.logo_url} alt={c.empresa} className="mb-4 max-h-12 max-w-[180px] object-contain" />
        : <p className="mb-4 text-sm font-semibold text-tenue">{c.empresa}</p>}
      <span className={`mb-3 flex size-11 items-center justify-center rounded-full ${cancelada ? 'bg-[#fee4e2] text-[#b42318]' : 'bg-[#dcfae6] text-[#067647]'}`}>
        {cancelada ? <CalendarX2 className="size-5" /> : <CalendarCheck className="size-5" />}
      </span>
      <h1 className="text-xl font-semibold">{cancelada ? 'Cita cancelada' : pasada ? 'Esta cita ya pasó' : 'Tu cita'}</h1>
      <p className="mt-1 text-[#475467]">{c.titulo} con {c.empresa}</p>
      <ul className="mt-5 space-y-2 text-sm text-[#344054]">
        <li className={`flex items-center gap-2 capitalize ${cancelada ? 'line-through' : ''}`}><CalendarCheck className="size-4 shrink-0" />{fechaLarga(diaEn(ini, c.zona_horaria))}</li>
        <li className={`flex items-center gap-2 ${cancelada ? 'line-through' : ''}`}><Clock className="size-4 shrink-0" />{horaEn(ini, c.zona_horaria)} – {horaEn(new Date(c.fin), c.zona_horaria)} ({c.zona_horaria.replace(/_/g, ' ')})</li>
        {c.ubicacion && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{c.ubicacion}</li>}
      </ul>
      {estado?.ok && <p role="status" className="mt-5 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm text-[#067647]">{estado.mensaje}</p>}
      {cancelada && c.slug && (
        <a href={`/reservar/${c.slug}`} className={`${estilosBoton.primario} mt-6 w-full`}>Reservar otra hora</a>
      )}
      {!cancelada && c.puede_cancelar && (
        <form action={accion} className="mt-6 space-y-3 border-t pt-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#344054]">¿Quieres cancelarla? Cuéntanos el motivo (opcional)</span>
            <textarea name="motivo" rows={2} maxLength={500} className={estiloArea} />
          </label>
          {estado && !estado.ok && <p role="alert" className="text-sm text-peligro">{estado.error}</p>}
          <BotonEnvio variante="peligro" className="w-full">Cancelar mi cita</BotonEnvio>
        </form>
      )}
      {!cancelada && !c.puede_cancelar && !pasada && (
        <p className="mt-6 text-sm text-tenue">Para cambiar o cancelar esta cita, ponte en contacto con {c.empresa}.</p>
      )}
    </div>
  );
}
