// Run every parity harness in sequence (renderer must be up on :5200 for the browser ones; app dist built for electron).
import { spawnSync } from 'node:child_process';
const cwd = new URL('.', import.meta.url).pathname;
const only = process.argv.slice(2);
const jobs = [
  ['smoke', ['smoke.mjs']], ['geo_l', ['geometry.mjs', 'light']], ['geo_d', ['geometry.mjs', 'dark']],
  ['ed_l', ['editor.mjs', 'light']], ['ed_d', ['editor.mjs', 'dark']], ['b08', ['b08.mjs']], ['b04', ['b04.mjs']],
  ['b03', ['b03.mjs']], ['b05', ['b05.mjs']], ['b05b', ['b05b.mjs']], ['electron', ['--experimental-websocket', 'electron.mjs']],
];
let failed = 0;
for (const [name, args] of jobs) {
  if (only.length && !only.includes(name)) continue;
  console.log(`\n=== ${name}`);
  const r = spawnSync('node', args, { cwd, stdio: 'inherit' });
  if (r.status) failed++;
}
process.exit(failed ? 1 : 0);
