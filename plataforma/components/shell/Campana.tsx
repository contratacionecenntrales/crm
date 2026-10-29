'use client';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, Trash2, X } from 'lucide-react';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { borrarNotificacion, marcarNotificacion, marcarTodasLeidas } from '@/app/acciones-panel';
import { haceCuanto } from '@/lib/formato';
import type { Notificacion } from '@/lib/tipos';

type ConSubcuenta = Notificacion & { subcuentas: { nombre: string } | null };

const CAMPOS = 'id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace, leida, creado, subcuentas(nombre)';

export function Campana({ usuarioId, iniciales }: { usuarioId: string; iniciales: ConSubcuenta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<'sistema' | 'alerta'>('sistema');
  const [lista, setLista] = useState<ConSubcuenta[]>(iniciales);
  const [, iniciar] = useTransition();
  const router = useRouter();

  const recargar = useCallback(async () => {
    const supabase = crearClienteNavegador();
    const { data } = await supabase.from('notificaciones').select(CAMPOS).order('creado', { ascending: false }).limit(50);
    if (data) setLista(data as unknown as ConSubcuenta[]);
  }, []);

  // Altas en directo por Realtime.
  useEffect(() => {
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel(`notificaciones:${usuarioId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` }, () => {
        void recargar();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, recargar]);

  useEffect(() => setLista(iniciales), [iniciales]);

  const sinLeer = lista.filter((n) => !n.leida).length;
  const visibles = lista.filter((n) => n.tipo === pestana);

  const abrir = () => {
    setAbierto(true);
    void recargar();
  };

  const pulsar = (n: ConSubcuenta) =>
    iniciar(async () => {
      if (!n.leida) {
        setLista((l) => l.map((x) => (x.id === n.id ? { ...x, leida: new Date().toISOString() } : x)));
        await marcarNotificacion(n.id);
      }
      if (n.enlace) {
        setAbierto(false);
        router.push(n.enlace);
      }
    });

  const todasLeidas = () =>
    iniciar(async () => {
      setLista((l) => l.map((x) => ({ ...x, leida: x.leida ?? new Date().toISOString() })));
      await marcarTodasLeidas();
    });

  const borrar = (id: string) =>
    iniciar(async () => {
      setLista((l) => l.filter((x) => x.id !== id));
      await borrarNotificacion(id);
    });

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Notificaciones${sinLeer ? `, ${sinLeer} sin leer` : ''}`}
        className="relative inline-flex size-10 items-center justify-center rounded-full bg-orange-500 text-white hover:opacity-90"
      >
        <Bell className="size-5" />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-superficie bg-amber-400 px-1 text-[10px] font-bold text-black">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setAbierto(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-superficie shadow-2xl" aria-label="Recordatorio">
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="text-xl font-semibold">Recordatorio</h2>
              <button onClick={() => setAbierto(false)} className="rounded p-1 text-tenue hover:bg-superficie-2" aria-label="Cerrar">
                <X className="size-6" />
              </button>
            </div>
            <div className="mt-3 flex gap-6 border-b px-5">
              {(['sistema', 'alerta'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPestana(p)}
                  className={`-mb-px border-b-2 pb-2 text-sm font-medium ${pestana === p ? 'border-primario text-primario' : 'border-transparent text-tenue'}`}
                >
                  {p === 'sistema' ? 'Sistema' : 'Alerta'}
                  {lista.some((n) => n.tipo === p && !n.leida) && <span className="ml-1 inline-block size-1.5 rounded-full bg-primario align-middle" />}
                </button>
              ))}
            </div>
            <div className="border-b px-5 py-3">
              <button onClick={todasLeidas} disabled={sinLeer === 0} className="text-sm font-medium underline disabled:text-tenue disabled:no-underline">
                Marcar todo como leído
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {visibles.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-tenue">
                  <BellRing className="size-8" />
                  No tienes avisos en esta pestaña.
                </li>
              )}
              {visibles.map((n) => (
                <li key={n.id} className={`group relative border-b ${n.leida ? '' : 'bg-primario-suave/60'}`}>
                  <button onClick={() => pulsar(n)} className="flex w-full gap-3 px-5 py-4 text-left">
                    <span className="mt-1 w-2 shrink-0">{!n.leida && <span className="block size-2 rounded-full bg-primario" />}</span>
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                      <Bell className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 text-xs">
                        <span className="text-primario">{n.categoria} · Notificación</span>
                        <span className="shrink-0 text-tenue">{haceCuanto(n.creado)}</span>
                      </span>
                      <span className="mt-1 block font-semibold">{n.titulo}</span>
                      {n.cuerpo && <span className="mt-1 block text-sm text-tenue">{n.cuerpo}</span>}
                      {n.subcuentas?.nombre && <span className="mt-1 block text-xs text-tenue">Subcuenta {n.subcuentas.nombre}</span>}
                    </span>
                  </button>
                  <button
                    onClick={() => borrar(n.id)}
                    aria-label="Borrar aviso"
                    className="absolute bottom-3 right-4 rounded p-1 text-tenue opacity-0 hover:text-peligro focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
