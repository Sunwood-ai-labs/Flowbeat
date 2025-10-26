import path from 'path';
import { promises as fs } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const mixpointsAssetPath = path.resolve(__dirname, 'public', 'assets', 'mixpoints.json');

    const mixpointsWriterPlugin = {
      name: 'flowbeat-mixpoints-writer',
      apply: 'serve' as const,
      configureServer(server) {
        server.middlewares.use('/api/mixpoints-cache', (req, res, next) => {
          if (req.method !== 'POST') {
            return next();
          }

          const chunks: Uint8Array[] = [];
          req.on('data', (chunk) => {
            chunks.push(chunk);
          });
          req.on('end', async () => {
            try {
              const body = Buffer.concat(chunks).toString('utf-8') || '{}';
              await fs.mkdir(path.dirname(mixpointsAssetPath), { recursive: true });
              await fs.writeFile(mixpointsAssetPath, body, 'utf-8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (error) {
              console.error('Failed to write mix point cache asset file:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(error) }));
            }
          });
        });
      },
    };

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), mixpointsWriterPlugin],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
