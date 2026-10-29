import { redirect } from 'next/navigation';
import { contextoAgencias, subcuentasVisibles } from '@/lib/sesion';

// Punto de entrada: cada usuario aterriza donde le corresponde.
export default async function Inicio() {
  const { actual } = await contextoAgencias();
  if (actual && actual.rol !== 'usuario') redirect('/agencia');
  const subs = await subcuentasVisibles();
  const primera = subs.find((s) => s.fijada) ?? subs[0];
  if (primera) redirect(`/subcuenta/${primera.id}`);
  if (actual) redirect('/agencia/subcuentas');
  redirect('/onboarding');
}
