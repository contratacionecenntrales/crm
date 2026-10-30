import { cx } from './clases';

const tonos = {
  azul: 'border-[#84adff] bg-[#eff4ff] text-[#155eef] dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  rojo: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  ambar: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  gris: 'border-borde bg-superficie-2 text-tenue',
};

export function Insignia({ tono = 'azul', children }: { tono?: keyof typeof tonos; children: React.ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', tonos[tono])}>{children}</span>;
}
