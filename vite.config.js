import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createPreference } from './api/_forward.js';

// En desarrollo (npm run dev) simula la función serverless /api/mercadopago
// para que el ACCESS TOKEN nunca llegue al navegador.
function mercadoPagoDevProxy(token) {
  return {
    name: 'mercadopago-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/mercadopago', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', async () => {
          try {
            const { status, data } = await createPreference(JSON.parse(raw || '{}'), token);
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), mercadoPagoDevProxy(env.MERCADOPAGO_ACCESS_TOKEN)],
  };
});
