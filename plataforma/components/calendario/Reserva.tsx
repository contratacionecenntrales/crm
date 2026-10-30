'use client';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, CalendarCheck, Clock, Globe, Loader2, MapPin } from 'lucide-react';
import { huecosPublicos, reservar } from '@/app/reservar/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { diaEn, duracionTexto, fechaLarga, horaEn, inicioMes, sumarDias, sumarMeses, type Dia } from '@/lib/calendario/tiempo';
import { MiniMes } from './MiniMes';

export interface InfoCalendario {
  nombre: string;
  descripcion: string;
  duracion_min: number;
  color: string;
  zona_horaria: string;
  ubicacion: string;
  dias_reserva: number;
  empresa: string;
  logo_url: string | null;
  privacidad: string | null;
  terminos: string | null;
}

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054]';

export function Reserva({ slug, info }: { slug: string; info: InfoCalendario }) {
  // La zona del visitante solo se conoce en el navegador; hasta entonces, la del calendario.
  const [zona, setZona] = useState(info.zona_horaria);
  const [zonas, setZonas] = useState<string[]>([info.zona_horaria]);
  useEffect(() => {
    const propia = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (propia) setZona(propia);
    try {
      const todas = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
      setZonas([...new Set([propia, info.zona_horaria, ...todas].filter(Boolean))]);
    } catch { /* navegador antiguo */ }
  }, [info.zona_horaria]);

  const hoy = diaEn(new Date(), zona);
  const [mes, setMes] = useState<Dia>(inicioMes(hoy));
  const [huecos, setHuecos] = useState<string[] | null>(null);
  const [cargando, iniciar] = useTransition();
  const [dia, setDia] = useState<Dia | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [paso, setPaso] = useState<'elegir' | 'datos'>('elegir');
  const [version, setVersion] = useState(0);
  const saltos = useRef(0); // meses que se han avanzado solos buscando horas libres

  useEffect(() => {
    let vivo = true;
    iniciar(async () => {
      const r = await huecosPublicos(slug, sumarDias(mes, -1), sumarDias(sumarMeses(mes, 1), 1));
      if (vivo) setHuecos(r);
    });
    return () => { vivo = false; };
  }, [slug, mes, version]);

  const porDia = useMemo(() => {
    const m = new Map<Dia, string[]>();
    for (const t of huecos ?? []) {
      const d = diaEn(new Date(t), zona);
      m.set(d, [...(m.get(d) ?? []), t]);
    }
    return m;
  }, [huecos, zona]);

  // Al cargar un mes, se elige solo el primer día con horas libres.
  useEffect(() => {
    if (!huecos) return;
    if (dia && porDia.has(dia)) return;
    const primero = [...porDia.keys()].filter((d) => d.slice(0, 7) === mes.slice(0, 7)).sort()[0];
    setDia(primero ?? null);
    // Al abrir la página, si este mes ya no tiene horas, se pasa solo al siguiente.
    if (!primero && saltos.current < 2 && sumarMeses(mes, 1) <= sumarDias(hoy, info.dias_reserva)) {
      saltos.current += 1;
      setMes(sumarMeses(mes, 1));
      setHuecos(null);
    }
  }, [huecos, porDia, mes, dia, hoy, info.dias_reserva]);

  const [resultado, accion] = useActionState(
    (prev: Awaited<ReturnType<typeof reservar>> | null, fd: FormData) => reservar(slug, hora ?? '', prev, fd), null,
  );
  useEffect(() => {
    if (resultado && !resultado.ok && resultado.ocupado) {
      setHora(null);
      setPaso('elegir');
      setVersion((v) => v + 1);
    }
  }, [resultado]);

  const fmtHora = (t: string) => horaEn(new Date(t), zona);
  const cabecera = (
    <div className="space-y-4 border-b p-6 md:w-[300px] md:shrink-0 md:border-b-0 md:border-r">
      {info.logo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={info.logo_url} alt={info.empresa} className="max-h-12 max-w-[180px] object-contain" />
        : <p className="text-sm font-semibold text-tenue">{info.empresa}</p>}
      <h1 className="text-xl font-semibold text-[#101828]">{info.nombre}</h1>
      <ul className="space-y-2 text-sm text-[#475467]">
        <li className="flex items-center gap-2"><Clock className="size-4 shrink-0" />{duracionTexto(info.duracion_min)}</li>
        {info.ubicacion && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /><span className="break-words">{info.ubicacion}</span></li>}
        {dia && hora && <li className="flex items-start gap-2 font-medium text-[#101828]"><CalendarCheck className="mt-0.5 size-4 shrink-0" />{fmtHora(hora)}, {fechaLarga(diaEn(new Date(hora), zona))}</li>}
      </ul>
      {info.descripcion && <p className="whitespace-pre-line text-sm text-[#475467]">{info.descripcion}</p>}
    </div>
  );

  if (resultado?.ok) {
    return (
      <div className="w-full max-w-lg self-start rounded-xl border border-borde bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#dcfae6] text-[#067647]"><CalendarCheck className="size-6" /></span>
        <h1 className="text-xl font-semibold text-[#101828]">¡Cita confirmada!</h1>
        <p className="mt-2 text-[#475467]">{info.nombre} con {info.empresa}</p>
        <p className="mt-4 text-lg font-medium capitalize text-[#101828]">{fechaLarga(diaEn(new Date(resultado.inicio), zona))}</p>
        <p className="text-[#475467]">{fmtHora(resultado.inicio)} – {fmtHora(resultado.fin)} ({zona.replace(/_/g, ' ')})</p>
        {resultado.ubicacion && <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[#475467]"><MapPin className="size-4" />{resultado.ubicacion}</p>}
        {resultado.confirmacion && <p className="mt-5 whitespace-pre-line rounded-lg bg-[#f9fafb] p-4 text-sm text-[#344054]">{resultado.confirmacion}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1000px] self-start overflow-hidden rounded-xl border border-borde bg-white text-[#101828] shadow-sm md:flex">
      {cabecera}
      {paso === 'elegir' ? (
        <div className="flex-1 p-6">
          <h2 className="mb-4 text-lg font-semibold">Elige día y hora</h2>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="lg:w-[340px]">
              <MiniMes
                key={mes}
                mesInicial={mes}
                grande
                seleccionado={dia}
                hoy={hoy}
                alElegir={(d) => { setDia(d); setHora(null); }}
                habilitado={(d) => porDia.has(d)}
                conHuecos={(d) => porDia.has(d) && d !== dia}
                alCambiarMes={(m) => { saltos.current = 2; setMes(m); setHuecos(null); setDia(null); setHora(null); }}
              />
              <label className="mt-5 block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-tenue"><Globe className="size-3.5" /> Zona horaria</span>
                <select value={zona} onChange={(e) => setZona(e.target.value)} className={`${estiloInput} text-[13px]`}>
                  {zonas.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
            </div>
            <div className="min-w-0 flex-1">
              {cargando || huecos === null ? (
                <p className="flex items-center gap-2 text-sm text-tenue"><Loader2 className="size-4 animate-spin" /> Buscando horas libres…</p>
              ) : !dia ? (
                <p className="text-sm text-tenue">No quedan horas libres este mes. Prueba con el siguiente.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm font-medium capitalize text-[#344054]">{fechaLarga(dia)}</p>
                  <div className="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {(porDia.get(dia) ?? []).map((t) => (
                      <button key={t} type="button" onClick={() => setHora(t)}
                        className={`h-10 rounded-lg border text-sm font-semibold ${hora === t ? 'border-primario bg-primario text-white' : 'border-[#b2ccff] text-primario-texto hover:border-primario'}`}>
                        {fmtHora(t)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {resultado && !resultado.ok && resultado.ocupado && <p role="alert" className="mt-3 text-sm text-peligro">{resultado.error}</p>}
              <div className="mt-6 flex justify-end">
                <button type="button" disabled={!hora} onClick={() => setPaso('datos')} className={estilosBoton.primario}>Continuar</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form action={accion} className="flex-1 space-y-4 p-6">
          <button type="button" onClick={() => setPaso('elegir')} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475467] hover:text-primario-texto">
            <ArrowLeft className="size-4" /> Cambiar la hora
          </button>
          <h2 className="text-lg font-semibold">Tus datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={etiqueta}>Nombre *</span><input name="nombre" required maxLength={100} autoComplete="given-name" className={estiloInput} /></label>
            <label className="block"><span className={etiqueta}>Apellidos</span><input name="apellidos" maxLength={100} autoComplete="family-name" className={estiloInput} /></label>
            <label className="block"><span className={etiqueta}>Correo electrónico *</span><input name="email" type="email" required maxLength={200} autoComplete="email" className={estiloInput} /></label>
            <label className="block"><span className={etiqueta}>Teléfono</span><input name="telefono" type="tel" maxLength={30} autoComplete="tel" className={estiloInput} /></label>
          </div>
          <label className="block"><span className={etiqueta}>¿Algo que debamos saber?</span><textarea name="notas" rows={3} maxLength={2000} className={estiloArea} /></label>
          <input name="web" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <label className="flex items-start gap-2 text-sm text-[#475467]">
            <input type="checkbox" name="acepto" required className="mt-0.5 size-4 accent-primario" />
            <span>
              Acepto que {info.empresa} use mis datos para gestionar esta cita
              {info.privacidad && <> (<a href={info.privacidad} target="_blank" rel="noreferrer" className="text-primario-texto underline">política de privacidad</a>)</>}
              {info.terminos && <> y los <a href={info.terminos} target="_blank" rel="noreferrer" className="text-primario-texto underline">términos</a></>}.
            </span>
          </label>
          {resultado && !resultado.ok && !resultado.ocupado && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{resultado.error}</p>
          )}
          <div className="flex justify-end"><BotonEnvio>Reservar cita</BotonEnvio></div>
        </form>
      )}
    </div>
  );
}
