import 'server-only';
import { after } from 'next/server';
import { iaConfigurada } from './claude';

// Tras guardar un mensaje entrante, contesta la cola de la IA sin hacer esperar
// a quien llamó (el cron lo recoge igualmente si esto falla).
export function despertarIA() {
  if (!iaConfigurada() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(async () => {
    try {
      const { procesarColaIA } = await import('./asistente');
      await procesarColaIA(5);
    } catch (e) {
      console.error('IA:', (e as Error).message);
    }
  });
}
