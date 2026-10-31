import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Metatok', template: '%s · Metatok' },
  description: 'CRM y automatización para agencias',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Aplica el tema guardado antes de pintar, para que no parpadee.
// React 19 vacía los formularios tras cada acción, incluso si el servidor
// devuelve un error: se perdería lo escrito. Se cancela ese reinicio salvo en
// los formularios que lo piden explícitamente (data-reiniciar="si").
const scriptFormularios = `document.addEventListener('reset',function(e){var f=e.target;if(f&&f.dataset&&f.dataset.reiniciar==='si'){delete f.dataset.reiniciar;return}e.preventDefault()},true);`;

// Las páginas públicas (reservas, citas, facturas) las ve el cliente final y van siempre en claro.
const scriptTema = `try{var t=localStorage.getItem('tema');if(/^\\/(reservar|cita|factura)\\//.test(location.pathname))t='claro';if(t==='oscuro'||((!t||t==='sistema')&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema + scriptFormularios }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
