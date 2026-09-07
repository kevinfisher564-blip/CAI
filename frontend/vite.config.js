import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const payloadEchoPlugin = (isDebug) => ({
  name: 'cai-payload-echo',
  configureServer(server) {
    if (!isDebug) return;
    server.middlewares.use((req, res, next) => {
      const isJsonPost =
        req.method === 'POST' &&
        req.url &&
        req.url.startsWith('/api/') &&
        (req.headers['content-type'] || '').includes('application/json');

      if (isJsonPost) {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const rawBody = Buffer.concat(chunks);
          req.rawBody = rawBody;
          try {
            const parsed = JSON.parse(rawBody.toString('utf-8'));
            const timestamp = new Date().toLocaleTimeString();
            console.log(`\n\x1b[1;35m======================================================================`);
            console.log(` [${timestamp}] PAYLOAD SENT TO -> ${req.url}`);
            console.log(`======================================================================\x1b[0m`);
            console.log(JSON.stringify(parsed, null, 2));
            console.log(`\x1b[1;35m======================================================================\x1b[0m\n`);
          } catch (e) {
            console.log(`\n[Raw Payload for ${req.url}]:`, rawBody.toString('utf-8'));
          }
          next();
        });
      } else {
        next();
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const args = process.argv || [];
  const isDebug =
    mode === 'debug' ||
    process.env.VITE_DEBUG_API === 'true' ||
    args.includes('--debug') ||
    args.includes('--debug-api');

  return {
    plugins: [react(), payloadEchoPlugin(isDebug)],
    define: {
      '__API_DEBUG__': JSON.stringify(isDebug)
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            if (isDebug) {
              console.log('\x1b[35m[CAI Dev Server] API Payload Echoing & Debug logging enabled.\x1b[0m');
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                if (req.rawBody) {
                  proxyReq.setHeader('Content-Type', req.headers['content-type'] || 'application/json');
                  proxyReq.setHeader('Content-Length', req.rawBody.length);
                  proxyReq.write(req.rawBody);
                }
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                const time = new Date().toLocaleTimeString();
                const statusColor = proxyRes.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
                console.log(`\x1b[32m[${time} API RES]\x1b[0m ${req.method} ${req.url} -> ${statusColor}${proxyRes.statusCode}\x1b[0m`);
              });
            }
          }
        },
        '/static': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
})

