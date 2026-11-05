'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { enviarFormularioEmbudo } from '@/app/f/acciones';
import type { Bloque } from '@/lib/embudos/tipos';

type B = Extract<Bloque, { tipo: 'formulario' }>;

export function FormularioPublico({ b, pasoId, destinoSiguiente, color, vistaPrevia }: { b: B; pasoId: string; destinoSiguiente: string | null; color: string; vistaPrevia?: boolean }) {
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'hecho'>('listo');
  const [error, setError] = useState('');
  const campo = 'w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-[15px] text-[#101828] placeholder:text-[#98a2b3] focus:outline-none focus:ring-2';
  if (estado === 'hecho') return <p className="rounded-lg bg-[#ecfdf3] px-4 py-3 text-center text-[15px] text-[#067647]">{b.mensaje || '¡Gracias! Hemos recibido tus datos.'}</p>;
  return (
    <form className="mx-auto w-full max-w-md space-y-3 text-left" onSubmit={async (e) => {
      e.preventDefault();
      if (vistaPrevia) return;
      const fd = new FormData(e.currentTarget);
      const datos = Object.fromEntries(b.campos.map((c) => [c.clave, String(fd.get(c.clave) ?? '').slice(0, 2000)]));
      setEstado('enviando'); setError('');
      const r = await enviarFormularioEmbudo(pasoId, b.id, datos, String(fd.get('web_url') ?? ''));
      if (!r.ok) { setEstado('listo'); setError(r.error ?? 'No se pudo enviar.'); return; }
      if (b.despues === 'siguiente' && destinoSiguiente) window.location.href = destinoSiguiente;
      else if (b.despues === 'url' && /^https?:\/\//.test(b.url)) window.location.href = b.url;
      else setEstado('hecho');
    }}>
      {b.campos.map((c) => (
        <label key={c.clave} className="block">
          <span className="mb-1 block text-sm font-medium text-[#344054]">{c.etiqueta}{c.obligatorio && ' *'}</span>
          {c.tipo === 'textarea'
            ? <textarea name={c.clave} required={c.obligatorio} maxLength={2000} rows={3} className={campo} style={{ ['--tw-ring-color' as string]: color + '55' }} />
            : <input name={c.clave} required={c.obligatorio} maxLength={200} className={campo} style={{ ['--tw-ring-color' as string]: color + '55' }}
                type={c.tipo === 'email' ? 'email' : c.tipo === 'tel' ? 'tel' : 'text'} autoComplete={c.clave === 'email' ? 'email' : c.clave === 'telefono' ? 'tel' : c.clave === 'nombre' ? 'name' : 'off'} />}
        </label>
      ))}
      <input name="web_url" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {b.aviso_legal && <p className="text-xs text-[#667085]">{b.aviso_legal}</p>}
      {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
      <button disabled={estado === 'enviando'} className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold text-white shadow-sm disabled:opacity-70" style={{ background: color }}>
        {estado === 'enviando' && <Loader2 className="size-4 animate-spin" />}{b.boton || 'Enviar'}
      </button>
    </form>
  );
}
