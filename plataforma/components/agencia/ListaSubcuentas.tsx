'use client';
import Link from 'next/link';
import { useActionState, useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeftRight, MapPin, MoreVertical, Phone, Search, UserPlus } from 'lucide-react';
import { cambiarEstadoSubcuenta, eliminarSubcuenta } from '@/app/agencia/acciones';
import { entrarEnSubcuenta } from '@/app/acciones-panel';
import { Avatar } from '@/components/ui/Avatar';
import { Insignia } from '@/components/ui/Insignia';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Vacio } from '@/components/ui/Vacio';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { FormularioSubcuenta } from './FormularioSubcuenta';
import { Facturacion } from './Facturacion';
import { dinero, direccionCompleta, fecha } from '@/lib/formato';
import type { Pago, Resultado, Subcuenta, Suscripcion } from '@/lib/tipos';

const TONO_ETAPA = { 'Cerrado (Ganado)': 'azul', Prueba: 'ambar', Prospecto: 'gris', Cancelado: 'rojo' } as const;

type Dialogo =
  | { tipo: 'crear' }
  | { tipo: 'editar'; s: Subcuenta }
  | { tipo: 'facturacion'; s: Subcuenta }
  | { tipo: 'eliminar'; s: Subcuenta }
  | null;

interface Props {
  subcuentas: Subcuenta[];
  suscripciones: Record<string, Suscripcion>;
  pagos: Record<string, Pago[]>;
  moneda: string;
  zona: string;
  esAdmin: boolean;
}

export function ListaSubcuentas({ subcuentas, suscripciones, pagos, moneda, zona, esAdmin }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const cerrar = useCallback(() => setDialogo(null), []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return subcuentas;
    return subcuentas.filter((s) =>
      [s.nombre, s.email ?? '', s.ciudad, s.telefono, s.id].some((v) => v.toLowerCase().includes(q)),
    );
  }, [subcuentas, busqueda]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Subcuentas</h1>
        <Insignia>{subcuentas.length} {subcuentas.length === 1 ? 'Subcuenta' : 'Subcuentas'}</Insignia>
        <div className="flex-1" />
        {esAdmin && (
          <button className={estilosBoton.primario} onClick={() => setDialogo({ tipo: 'crear' })}>
            <UserPlus className="size-4" /> Crear Subcuenta
          </button>
        )}
      </div>

      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo, ciudad o ID"
          className={`${estiloInput} pl-9`} />
      </label>

      {aviso && <div className="mt-4"><Aviso estado={aviso} /></div>}

      {filtradas.length === 0 ? (
        <div className="mt-6 rounded-lg border border-borde bg-superficie">
          {subcuentas.length === 0 ? (
            <Vacio titulo="Aún no tienes subcuentas" texto="Cada subcuenta es un negocio cliente con sus propios contactos, calendarios y conversaciones.">
              {esAdmin && (
                <button className={estilosBoton.primario} onClick={() => setDialogo({ tipo: 'crear' })}>
                  <UserPlus className="size-4" /> Crear la primera
                </button>
              )}
            </Vacio>
          ) : (
            <Vacio titulo="Ninguna subcuenta coincide con la búsqueda" />
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {filtradas.map((s) => (
            <TarjetaSubcuenta key={s.id} s={s} suscripcion={suscripciones[s.id]} moneda={moneda} zona={zona} esAdmin={esAdmin}
              alAbrir={setDialogo} alAviso={setAviso} />
          ))}
        </ul>
      )}

      <Modal abierto={dialogo?.tipo === 'crear'} alCerrar={cerrar} titulo="Crear subcuenta" ancho="max-w-2xl">
        <FormularioSubcuenta alTerminar={cerrar} />
      </Modal>
      <Modal abierto={dialogo?.tipo === 'editar'} alCerrar={cerrar} titulo="Editar subcuenta" ancho="max-w-2xl">
        {dialogo?.tipo === 'editar' && <FormularioSubcuenta subcuenta={dialogo.s} alTerminar={cerrar} />}
      </Modal>
      <Modal abierto={dialogo?.tipo === 'facturacion'} alCerrar={cerrar}
        titulo={dialogo?.tipo === 'facturacion' ? `Plan y facturación · ${dialogo.s.nombre}` : ''} ancho="max-w-2xl">
        {dialogo?.tipo === 'facturacion' && (
          <Facturacion subcuentaId={dialogo.s.id} suscripcion={suscripciones[dialogo.s.id] ?? null} pagos={pagos[dialogo.s.id] ?? []} moneda={moneda} />
        )}
      </Modal>
      <Modal abierto={dialogo?.tipo === 'eliminar'} alCerrar={cerrar} titulo="Eliminar subcuenta">
        {dialogo?.tipo === 'eliminar' && <ConfirmarEliminar s={dialogo.s} alTerminar={cerrar} alAviso={setAviso} />}
      </Modal>
    </div>
  );
}

function TarjetaSubcuenta({ s, suscripcion, moneda, zona, esAdmin, alAbrir, alAviso }: {
  s: Subcuenta; suscripcion?: Suscripcion; moneda: string; zona: string; esAdmin: boolean;
  alAbrir: (d: Dialogo) => void; alAviso: (r: Resultado | null) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, menu, () => setMenu(false));
  const direccion = direccionCompleta(s);
  const suspendida = s.estado === 'suspendida';

  const accionMenu = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <li className={`overflow-visible rounded-lg border border-borde bg-superficie ${suspendida ? 'opacity-75' : ''}`}>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:gap-8 sm:p-6">
        <div className="flex min-w-0 gap-4">
          <Avatar nombre={s.nombre} url={s.logo_url} tam="size-14" suave />
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg">{s.nombre}</span>
              <Insignia tono={TONO_ETAPA[s.etapa]}>{s.etapa}</Insignia>
              {suspendida && <Insignia tono="rojo">Suspendida</Insignia>}
            </div>
            {direccion && (
              <p className="flex items-start gap-2 text-sm text-tenue"><MapPin className="mt-0.5 size-4 shrink-0" /> {direccion}</p>
            )}
            {s.telefono && (
              <p className="flex items-center gap-2 text-sm text-tenue"><Phone className="size-4 shrink-0" /> {s.prefijo} {s.telefono}</p>
            )}
            {!direccion && !s.telefono && <p className="flex items-center gap-2 text-sm text-tenue"><MapPin className="size-4" /> Sin datos de contacto</p>}
          </div>
        </div>
        <div>
          <p className="text-sm text-tenue">Fecha de adición</p>
          <p className="mt-2 text-lg">{fecha(s.creado, zona)}</p>
        </div>
        <div>
          <p className="text-sm text-tenue">Último inicio de sesión</p>
          <p className="mt-2 text-lg">{s.ultimo_acceso ? fecha(s.ultimo_acceso, zona) : 'Nunca'}</p>
          {esAdmin && suscripcion && suscripcion.estado !== 'cancelada' && (
            <p className="mt-1 text-xs text-tenue">{suscripcion.plan} · {dinero(suscripcion.importe_mensual, moneda)}/mes</p>
          )}
        </div>
      </div>
      <div className="flex items-center border-t bg-superficie-2">
        <div className="flex-1" />
        <button
          disabled={pendiente || suspendida}
          onClick={() => iniciar(() => entrarEnSubcuenta(s.id))}
          className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-primario hover:underline disabled:text-tenue disabled:no-underline"
        >
          <ArrowLeftRight className="size-4" /> Cambiar a subcuenta
        </button>
        {esAdmin && (
          <div ref={caja} className="relative border-l">
            <button onClick={() => setMenu((v) => !v)} aria-label="Más acciones" aria-expanded={menu} className="px-4 py-3 text-tenue hover:text-texto">
              <MoreVertical className="size-5" />
            </button>
            {menu && (
              <div className="absolute bottom-full right-2 z-20 mb-1 w-56 rounded-lg border border-borde bg-superficie p-1 shadow-xl">
                <ItemMenu onClick={accionMenu(() => alAbrir({ tipo: 'editar', s }))}>Editar datos</ItemMenu>
                <ItemMenu onClick={accionMenu(() => alAbrir({ tipo: 'facturacion', s }))}>Plan y facturación</ItemMenu>
                <Link href={`/subcuenta/${s.id}/configuracion/usuarios`}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-superficie-2">Usuarios de la subcuenta</Link>
                <ItemMenu onClick={accionMenu(() => iniciar(async () => alAviso(await cambiarEstadoSubcuenta(s.id, suspendida ? 'activa' : 'suspendida'))))}>
                  {suspendida ? 'Reactivar' : 'Suspender'}
                </ItemMenu>
                <ItemMenu peligro onClick={accionMenu(() => alAbrir({ tipo: 'eliminar', s }))}>Eliminar</ItemMenu>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function ItemMenu({ children, onClick, peligro }: { children: React.ReactNode; onClick: () => void; peligro?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-superficie-2 ${peligro ? 'text-peligro' : ''}`}>
      {children}
    </button>
  );
}

function ConfirmarEliminar({ s, alTerminar, alAviso }: { s: Subcuenta; alTerminar: () => void; alAviso: (r: Resultado) => void }) {
  const [estado, accion] = useActionState(async (prev: Resultado | null, fd: FormData) => {
    const r = await eliminarSubcuenta(prev, fd);
    if (r.ok) {
      alAviso(r);
      alTerminar();
    }
    return r;
  }, null);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={s.id} />
      <p className="text-sm">
        Se borrarán <strong>todos los datos</strong> de <strong>{s.nombre}</strong>: usuarios, plan, pagos asociados y, cuando existan, contactos, conversaciones y citas. No se puede deshacer.
      </p>
      <Campo etiqueta={`Escribe «${s.nombre}» para confirmar`} name="confirmacion" autoComplete="off" required />
      <Aviso estado={estado} />
      <div className="flex justify-end">
        <BotonEnvio variante="peligro">Eliminar definitivamente</BotonEnvio>
      </div>
    </form>
  );
}
