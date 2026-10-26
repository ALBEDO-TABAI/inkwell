// Bundles the Electron main process and preloads with esbuild (CommonJS, node platform).
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const common = {
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', sourcemap: 'linked', logLevel: 'info',
  external: ['electron', 'better-sqlite3'],
  alias: { '@shared': path.resolve(dir, '../shared/src') },
};
await Promise.all([
  build({ ...common, entryPoints: [path.join(dir, 'src/main.ts')], outfile: path.join(dir, 'dist/main.cjs') }),
  build({ ...common, entryPoints: [path.join(dir, 'src/preload-app.ts')], outfile: path.join(dir, 'dist/preload-app.cjs') }),
  build({ ...common, entryPoints: [path.join(dir, 'src/preload-tabbar.ts')], outfile: path.join(dir, 'dist/preload-tabbar.cjs') }),
]);
