import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const personalDataRoot = path.resolve(rootDir, '../__personal__');

function servePersonalData(): Plugin {
  return {
    name: 'serve-personal-data',
    configureServer(server) {
      server.middlewares.use('/__personal__', (req, res, next) => {
        const urlPath = req.url?.split('?')[0] ?? '';
        const relative = decodeURIComponent(urlPath.replace(/^\//, ''));
        const filePath = path.resolve(personalDataRoot, relative);
        if (
          filePath !== personalDataRoot &&
          !filePath.startsWith(`${personalDataRoot}${path.sep}`)
        ) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(filePath, (err, stat) => {
          if (err != null || !stat.isFile()) {
            next();
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servePersonalData()],
  resolve: {
    alias: {
      '@lifemap/assets': path.resolve(rootDir, '../assets'),
      '@lifemap/constants': path.resolve(
        rootDir,
        '../packages/constants/src/index.ts',
      ),
      '@lifemap/copy': path.resolve(rootDir, '../packages/copy/src/index.ts'),
      '@lifemap/segmentation': path.resolve(
        rootDir,
        '../packages/segmentation/src',
      ),
    },
  },
  server: {
    port: 5174,
    open: true,
    fs: {
      allow: [rootDir, personalDataRoot],
    },
  },
});
