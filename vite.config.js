import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where `npm run dev` forwards API and websocket traffic.
  const devTarget = env.VITE_DEV_API_TARGET || 'http://localhost:8080';

  return {
    plugins: [react(), tailwindcss()],

    define: {
      // sockjs-client expects a Node-style `global`.
      global: 'globalThis',
    },

    server: {
      port: 5173,
      // Same-origin in development, so no CORS setup is needed on the backend.
      proxy: {
        '/api': { target: devTarget, changeOrigin: true },
        '/ws': { target: devTarget, changeOrigin: true, ws: true },
      },
    },

    test: {
      environment: 'jsdom',
      globals: true,
    },

    build: {
      // Shipped sourcemaps make production stack traces readable.
      sourcemap: true,
      rollupOptions: {
        output: {
          // Split rarely-changing vendor code so app deploys don't bust its cache.
          advancedChunks: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              },
              {
                name: 'realtime',
                test: /node_modules[\\/](@stomp[\\/]stompjs|sockjs-client)[\\/]/,
              },
            ],
          },
        },
      },
    },
  };
});
