'use client';
import { estiloInput, estiloArea } from '@/components/ui/clases';
import type { Campo, ValorCampo } from '@/lib/crm/tipos';

// Control de formulario adecuado al tipo de cada campo personalizado.
export function CampoPersonalizado({ campo, valor }: { campo: Campo; valor: ValorCampo | undefined }) {
  const nombre = `campo:${campo.clave}`;
  const texto = valor === undefined || valor === null ? '' : String(valor);
  let control: React.ReactNode;
  switch (campo.tipo) {
    case 'texto_largo':
      control = <textarea name={nombre} defaultValue={texto} rows={3} className={estiloArea} maxLength={5000} />;
      break;
    case 'numero':
    case 'moneda':
      control = <input name={nombre} defaultValue={texto} inputMode="decimal" className={estiloInput} />;
      break;
    case 'fecha':
      control = <input type="date" name={nombre} defaultValue={texto} className={estiloInput} />;
      break;
    case 'lista':
      control = (
        <select name={nombre} defaultValue={texto} className={estiloInput}>
          <option value="">—</option>
          {campo.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'casillas': {
      const marcadas = Array.isArray(valor) ? valor : [];
      control = (
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {campo.opciones.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={nombre} value={o} defaultChecked={marcadas.includes(o)} className="size-4 accent-[var(--color-primario)]" />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case 'si_no':
      control = (
        <select name={nombre} defaultValue={valor === true ? 'si' : valor === false ? 'no' : ''} className={estiloInput}>
          <option value="">—</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      );
      break;
    case 'email':
      control = <input type="email" name={nombre} defaultValue={texto} className={estiloInput} />;
      break;
    case 'url':
      control = <input type="url" name={nombre} defaultValue={texto} placeholder="https://" className={estiloInput} />;
      break;
    case 'telefono':
      control = <input type="tel" name={nombre} defaultValue={texto} className={estiloInput} />;
      break;
    default:
      control = <input name={nombre} defaultValue={texto} maxLength={500} className={estiloInput} />;
  }
  return (
    <div className="block">
      <span className="mb-1 block text-sm text-tenue">{campo.nombre}</span>
      {control}
    </div>
  );
}

export function mostrarValor(campo: Pick<Campo, 'tipo'>, v: ValorCampo | undefined): string {
  if (v === undefined || v === null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (campo.tipo === 'fecha' && typeof v === 'string') {
    const [a, m, d] = v.split('-');
    return `${d}/${m}/${a}`;
  }
  return String(v);
}
