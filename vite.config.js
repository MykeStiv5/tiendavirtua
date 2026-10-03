import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo (npm run dev) simula las funciones serverless de la carpeta api/ (Vercel las
// sirve solas en producción). Así el ACCESS TOKEN y la service_role nunca llegan al navegador.
//   /api/<nombre>  → api/<nombre>.js
//   /p/<id>        → api/share.js?id=<id>   (enlace para compartir productos)
function apiDevProxy() {
  return {
    name: 'api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        let name = null;
        const query = Object.fromEntries(url.searchParams);

        const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
        const share = url.pathname.match(/^\/p\/([0-9a-f-]{36})$/i);
        if (api) name = api[1];
        else if (share) {
          name = 'share';
          query.id = share[1];
        }

        const file = name && resolve(process.cwd(), 'api', `${name}.js`);
        if (!file || name.startsWith('_') || !existsSync(file)) return next();

        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', async () => {
          try {
            const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
            req.query = query;
            req.body = raw || undefined;
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
            await mod.default(req, res);
          } catch (error) {
            console.error(`[api/${name}]`, error);
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
  Object.assign(process.env, env); // las funciones de api/ leen SUPABASE_SERVICE_ROLE_KEY, SMTP_*, etc.
  return {
    plugins: [react(), apiDevProxy()],
  };
});
