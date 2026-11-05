'use client';
import { useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { valorarResena } from '@/app/resena/[token]/acciones';

export function Valorar({ token, empresa, nombre, yaValorada }: { token: string; empresa: string; nombre: string; yaValorada: boolean }) {
  const [n, setN] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [estado, setEstado] = useState<'pregunta' | 'enviando' | 'gracias' | 'redirigiendo'>(yaValorada ? 'gracias' : 'pregunta');
  const [error, setError] = useState('');
  const mala = n > 0 && n <= 3;
  if (estado === 'gracias' || estado === 'redirigiendo') return (
    <div>
      <CheckCircle2 className="mx-auto size-12 text-[#12b76a]" />
      <h1 className="mt-4 text-xl font-semibold">¡Gracias por tu opinión!</h1>
      <p className="mt-2 text-sm text-[#475467]">{estado === 'redirigiendo' ? 'Te llevamos a la página de reseñas para que puedas publicarla…' : `En ${empresa} la tendremos muy en cuenta.`}</p>
    </div>
  );
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!n) return setError('Elige de 1 a 5 estrellas.');
      setEstado('enviando'); setError('');
      const r = await valorarResena(token, n, comentario);
      if (!r.ok) { setEstado('pregunta'); setError(r.error ?? 'Error'); return; }
      if (r.enlace) { setEstado('redirigiendo'); window.location.href = r.enlace; } else setEstado('gracias');
    }}>
      <h1 className="text-xl font-semibold">{nombre ? `${nombre}, ¿qué` : '¿Qué'} tal tu experiencia con {empresa}?</h1>
      <div className="mt-5 flex justify-center gap-1" role="radiogroup" aria-label="Puntuación" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={n === i} aria-label={`${i} estrella${i > 1 ? 's' : ''}`} onClick={() => setN(i)} onMouseEnter={() => setHover(i)} className="p-1">
            <Star className={`size-10 transition ${i <= (hover || n) ? 'fill-[#fdb022] text-[#fdb022]' : 'text-[#d0d5dd]'}`} />
          </button>
        ))}
      </div>
      {n > 0 && (
        <label className="mt-5 block text-left">
          <span className="mb-1 block text-sm font-medium text-[#344054]">{mala ? '¿Qué podemos mejorar? (solo lo verá el equipo)' : 'Cuéntanos algo más (opcional)'}</span>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-[#d0d5dd] px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#155eef]/30" />
        </label>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-[#b42318]">{error}</p>}
      <button disabled={estado === 'enviando'} className="mt-5 w-full rounded-lg bg-[#155eef] px-5 py-3 font-semibold text-white disabled:opacity-70">{estado === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
    </form>
  );
}
