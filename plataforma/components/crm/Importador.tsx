'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { importarTrozo, type ResultadoImportacion } from '@/app/subcuenta/[id]/contactos/acciones';
import { leerCsv, sugerirMapeo } from '@/lib/crm/csv';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import type { Campo } from '@/lib/crm/tipos';

const DESTINOS = [
  ['', 'No importar'], ['nombre', 'Nombre'], ['apellidos', 'Apellidos'], ['nombre_completo', 'Nombre completo'],
  ['email', 'Correo electrónico'], ['telefono', 'Teléfono'], ['empresa', 'Nombre de la empresa'], ['etiquetas', 'Etiquetas'],
  ['tipo', 'Tipo de contacto'], ['fuente', 'Fuente de contacto'], ['direccion', 'Dirección postal'], ['ciudad', 'Ciudad'],
  ['provincia', 'Provincia'], ['codigo_postal', 'Código postal'], ['pais', 'País'], ['web', 'Sitio web'],
  ['fecha_nacimiento', 'Fecha de nacimiento (AAAA-MM-DD)'],
] as const;

const TROZO = 200;
const MAX_FILAS = 50_000;

export function Importador({ subId, campos, alTerminar }: { subId: string; campos: Campo[]; alTerminar: () => void }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<string[]>([]);
  const [duplicados, setDuplicados] = useState<'actualizar' | 'omitir'>('actualizar');
  const [etiqueta, setEtiqueta] = useState('');
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState<{ hechas: number; creados: number; actualizados: number; errores: { fila: number; motivo: string }[] } | null>(null);
  const [terminado, setTerminado] = useState(false);

  const cabecera = filas[0] ?? [];
  const datos = filas.slice(1);
  const destinos = useMemo(() => [...DESTINOS, ...campos.map((c) => [`campo:${c.clave}`, `${c.nombre} (personalizado)`] as const)], [campos]);

  const leer = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setError('El archivo supera 20 MB.');
    const texto = await f.text();
    const t = leerCsv(texto);
    if (t.length < 2) return setError('El archivo no tiene filas de datos.');
    if (t.length - 1 > MAX_FILAS) return setError(`Máximo ${MAX_FILAS.toLocaleString('es-ES')} filas por importación.`);
    setArchivo(f.name);
    setFilas(t);
    setMapeo(sugerirMapeo(t[0], campos));
  };

  const importar = async () => {
    const usados = mapeo.filter(Boolean);
    if (!usados.some((m) => ['nombre', 'apellidos', 'nombre_completo', 'email', 'telefono'].includes(m))) {
      return setError('Asigna al menos una columna a nombre, correo o teléfono.');
    }
    if (new Set(usados).size !== usados.length) return setError('Hay dos columnas apuntando al mismo campo.');
    setError('');
    const acumulado = { hechas: 0, creados: 0, actualizados: 0, errores: [] as { fila: number; motivo: string }[] };
    setProgreso({ ...acumulado });
    let loteId: string | undefined;
    for (let i = 0; i < datos.length; i += TROZO) {
      const trozo = datos.slice(i, i + TROZO).map((fila) => {
        const o: Record<string, string> = {};
        mapeo.forEach((m, j) => {
          if (m) o[m] = fila[j] ?? '';
        });
        return o;
      });
      let r: ResultadoImportacion;
      try {
        r = await importarTrozo(subId, {
          loteId, archivo, filas: trozo, inicio: i + 2, totalFilas: datos.length, duplicados, etiqueta,
          ultimo: i + TROZO >= datos.length,
        });
      } catch {
        r = { ok: false, creados: 0, actualizados: 0, errores: [], error: 'Se perdió la conexión con el servidor.' };
      }
      if (!r.ok) {
        setError(`${r.error ?? 'Error'} — importadas ${acumulado.creados + acumulado.actualizados} filas antes del fallo.`);
        break;
      }
      loteId = r.loteId;
      acumulado.hechas += trozo.length;
      acumulado.creados += r.creados;
      acumulado.actualizados += r.actualizados;
      acumulado.errores.push(...r.errores);
      setProgreso({ ...acumulado, errores: [...acumulado.errores] });
    }
    setTerminado(true);
    router.refresh();
  };

  if (progreso) {
    const pct = Math.round((progreso.hechas / Math.max(1, datos.length)) * 100);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 font-medium">
          {terminado ? <CheckCircle2 className="size-5 text-exito" /> : <Loader2 className="size-5 animate-spin text-primario" />}
          {terminado ? 'Importación terminada' : `Importando ${archivo}…`}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-superficie-2">
          <div className="h-full bg-primario transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm">
          {progreso.hechas.toLocaleString('es-ES')} de {datos.length.toLocaleString('es-ES')} filas · {progreso.creados} creados ·{' '}
          {progreso.actualizados} actualizados · <span className={progreso.errores.length ? 'text-peligro' : ''}>{progreso.errores.length} con errores</span>
        </p>
        {error && <p className="text-sm text-peligro">{error}</p>}
        {progreso.errores.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-lg border text-sm">
            {progreso.errores.slice(0, 200).map((e, i) => (
              <li key={i} className="border-b px-3 py-1.5 last:border-0">Fila {e.fila}: {e.motivo}</li>
            ))}
          </ul>
        )}
        {terminado && <div className="flex justify-end"><button className={estilosBoton.primario} onClick={alTerminar}>Cerrar</button></div>}
      </div>
    );
  }

  if (!filas.length) {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center hover:border-primario">
          <FileUp className="size-8 text-primario" />
          <span className="font-medium">Elige un archivo CSV</span>
          <span className="text-sm text-tenue">Separado por comas o punto y coma, con una fila de cabecera. Hasta 50.000 filas.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => leer(e.target.files?.[0])} />
        </label>
        {error && <p className="text-sm text-peligro">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <strong>{archivo}</strong> · {datos.length.toLocaleString('es-ES')} filas. Indica a qué campo va cada columna.
      </p>
      <div className="max-h-80 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-superficie-2 text-left text-tenue">
            <tr><th className="px-3 py-2">Columna del CSV</th><th className="px-3 py-2">Ejemplo</th><th className="px-3 py-2">Campo</th></tr>
          </thead>
          <tbody>
            {cabecera.map((h, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-medium">{h || `Columna ${i + 1}`}</td>
                <td className="max-w-40 truncate px-3 py-2 text-tenue">{datos.find((d) => d[i])?.[i] ?? ''}</td>
                <td className="px-3 py-2">
                  <select value={mapeo[i] ?? ''} onChange={(e) => setMapeo((m) => m.map((x, j) => (j === i ? e.target.value : x)))}
                    className={`${estiloInput} py-1.5`} aria-label={`Campo para ${h}`}>
                    {destinos.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Si el correo ya existe</span>
          <select value={duplicados} onChange={(e) => setDuplicados(e.target.value as never)} className={estiloInput}>
            <option value="actualizar">Actualizar el contacto existente</option>
            <option value="omitir">Omitir la fila</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Etiqueta para todos (opcional)</span>
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={60} placeholder="importado-octubre" className={estiloInput} />
        </label>
      </div>
      {error && <p className="text-sm text-peligro">{error}</p>}
      <div className="flex justify-between gap-2">
        <button className={estilosBoton.secundario} onClick={() => setFilas([])}>Otro archivo</button>
        <button className={estilosBoton.primario} onClick={importar}>Importar {datos.length.toLocaleString('es-ES')} contactos</button>
      </div>
    </div>
  );
}
