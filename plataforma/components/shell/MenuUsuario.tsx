'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useFueraDe } from './useFueraDe';

type Tema = 'claro' | 'oscuro' | 'sistema';

function aplicarTema(t: Tema) {
  const oscuro = t === 'oscuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', oscuro);
  try {
    // «sistema» se guarda tal cual: así el tema por defecto de la agencia no lo pisa.
    localStorage.setItem('tema', t);
  } catch {
    /* almacenamiento bloqueado: el tema dura lo que la pestaña */
  }
}

export function MenuUsuario({ nombre, email, logo, perfil }: { nombre: string; email: string; logo?: string | null; perfil?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState<Tema>('sistema');
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, abierto, () => setAbierto(false));

  useEffect(() => {
    try {
      const t = localStorage.getItem('tema');
      if (t === 'claro' || t === 'oscuro' || t === 'sistema') setTema(t);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const elegir = (t: Tema) => {
    setTema(t);
    aplicarTema(t);
  };

  return (
    <div ref={caja} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-label="Menú de usuario" className="ml-1.5 rounded-full">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-8 max-w-[40px] object-contain" />
        ) : (
          <Avatar nombre={nombre || email} tam="size-8" />
        )}
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border bg-superficie p-2 font-sans shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{nombre || email.split('@')[0]}</p>
            <p className="truncate text-xs text-tenue">{email}</p>
          </div>
          {perfil && (
            <Link href={perfil} onClick={() => setAbierto(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie-2">
              <UserRound className="size-4" /> Mi perfil
            </Link>
          )}
          <div className="my-1 border-t" />
          <p className="px-3 pt-1 text-xs font-medium text-tenue">Tema</p>
          <div className="grid grid-cols-3 gap-1 p-2">
            {([
              ['claro', Sun, 'Claro'],
              ['oscuro', Moon, 'Oscuro'],
              ['sistema', Monitor, 'Sistema'],
            ] as const).map(([valor, Icono, texto]) => (
              <button
                key={valor}
                onClick={() => elegir(valor)}
                aria-pressed={tema === valor}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs ${tema === valor ? 'border-primario text-primario' : 'text-tenue hover:bg-superficie-2'}`}
              >
                <Icono className="size-4" />
                {texto}
              </button>
            ))}
          </div>
          <div className="my-1 border-t" />
          <form action="/auth/salir" method="post">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie-2">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
