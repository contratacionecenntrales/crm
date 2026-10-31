import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
      // El panel no se puede meter en un iframe ajeno; la página de reservas sí
      // (es el «código para insertar» del calendario).
      { source: '/((?!reservar/|chat/).*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/reservar/:slug*', headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }] },
      // La ventana del chat web se abre dentro de la web del cliente.
      { source: '/chat/:clave*', headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }] },
    ];
  },
};

export default nextConfig;
