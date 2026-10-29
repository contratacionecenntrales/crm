import { estiloInput } from './clases';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string };

export function Campo({ etiqueta, ayuda, id, name, className, ...resto }: Props) {
  const ident = id ?? name;
  return (
    <label htmlFor={ident} className={'block ' + (className ?? '')}>
      <span className="mb-1 block text-sm font-medium text-texto">{etiqueta}</span>
      <input id={ident} name={name} className={estiloInput} {...resto} />
      {ayuda && <span className="mt-1 block text-xs text-tenue">{ayuda}</span>}
    </label>
  );
}

type PropsSelect = React.SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
};

export function Selector({ etiqueta, opciones, id, name, className, ...resto }: PropsSelect) {
  const ident = id ?? name;
  return (
    <label htmlFor={ident} className={'block ' + (className ?? '')}>
      <span className="mb-1 block text-sm font-medium text-texto">{etiqueta}</span>
      <select id={ident} name={name} className={estiloInput} {...resto}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
