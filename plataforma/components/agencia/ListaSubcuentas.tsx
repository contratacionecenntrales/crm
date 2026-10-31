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

const ETAPA_CLASE = {
  'Cerrado (Ganado)': 'border-[#84caff] bg-[#eff8ff] text-[#175cd3]',
  Prueba: 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]',
  Prospecto: 'border-[#d0d5dd] bg-[#f9fafb] text-[#344054]',
  Cancelado: 'border-[#fecdca] bg-[#fef3f2] text-[#b42318]',
} as const;

// Menú ⋮ de la cabecera: exportar la lista (lo que se ve, con el filtro aplicado).
function MenuCabecera({ subcuentas, zona }: { subcuentas: Subcuenta[]; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, abierto, () => setAbierto(false));
  const exportar = () => {
    const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const filas = [['Nombre', 'Correo', 'Teléfono', 'Dirección', 'Etapa', 'Estado', 'Fecha de adición', 'Último inicio de sesión', 'ID']]
      .concat(subcuentas.map((s) => [s.nombre, s.email ?? '', s.telefono ? `${s.prefijo} ${s.telefono}` : '', direccionCompleta(s), s.etapa, s.estado,
        fecha(s.creado, zona), s.ultimo_acceso ? fecha(s.ultimo_acceso, zona) : '', s.id]));
    const csv = '\ufeff' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `subcuentas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setAbierto(false);
  };
  return (
    <div ref={caja} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-label="Más opciones" aria-expanded={abierto} className="rounded p-2 text-[#475467] dark:text-texto-2 hover:bg-superficie-2">
        <MoreVertical className="size-5" />
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-borde bg-superficie p-1 shadow-xl">
          <ItemMenu onClick={exportar}>Exportar a CSV ({subcuentas.length})</ItemMenu>
        </div>
      )}
    </div>
  );
}

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
        <h1 className="text-[28px] font-medium leading-9 text-[#101828] dark:text-texto">Subcuentas</h1>
        <span className="rounded-full bg-[#eff8ff] px-3 py-0.5 text-sm font-medium text-[#175cd3]">
          {subcuentas.length} {subcuentas.length === 1 ? 'Subcuenta' : 'Subcuentas'}
        </span>
        <div className="flex-1" />
        {esAdmin && (
          <button className={`${estilosBoton.primario} h-10 px-4`} onClick={() => setDialogo({ tipo: 'crear' })}>
            <UserPlus className="size-5" /> Crear Subcuenta
          </button>
        )}
        <MenuCabecera subcuentas={filtradas} zona={zona} />
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
    <li className={`overflow-visible rounded-lg border border-borde bg-superficie shadow-[0_1px_3px_rgba(16,24,40,0.1)] ${suspendida ? 'opacity-75' : ''}`}>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:gap-8 sm:p-6">
        <div className="flex min-w-0 gap-4">
          <Avatar nombre={s.nombre} url={s.logo_url} tam="size-14" suave />
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg text-[#101828] dark:text-texto">{s.nombre}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-sm ${ETAPA_CLASE[s.etapa]}`}>{s.etapa}</span>
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
          <p className="mt-2 text-lg font-medium text-[#101828] dark:text-texto">{fecha(s.creado, zona)}</p>
        </div>
        <div>
          <p className="text-sm text-tenue">Último inicio de sesión</p>
          <p className="mt-2 text-lg font-medium text-[#101828] dark:text-texto">{s.ultimo_acceso ? fecha(s.ultimo_acceso, zona) : 'Nunca'}</p>
          {esAdmin && suscripcion && suscripcion.estado !== 'cancelada' && (
            <p className="mt-1 text-xs text-tenue">{suscripcion.plan} · {dinero(suscripcion.importe_mensual, moneda)}/mes</p>
          )}
        </div>
      </div>
      <div className="flex min-h-[72px] items-center rounded-b-lg border-t bg-[#f9fafb] dark:bg-superficie-2">
        <div className="flex-1" />
        <button
          disabled={pendiente || suspendida}
          onClick={() => iniciar(async () => {
            const r = await entrarEnSubcuenta(s.id);
            if (r && !r.ok) alAviso(r);
          })}
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
