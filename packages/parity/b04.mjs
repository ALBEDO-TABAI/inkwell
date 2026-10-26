// B04 header variants: codex 1x window shots (tab bar 36px on top) vs our webview at 1320x824.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/B04';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const cwd = new URL('.', import.meta.url).pathname;
const setFmt = (id, fmt) => `(() => { const s = window.__ink.store; s.transact('t', (tx) => tx.update('${id}', (b) => ({ format: { ...b.format, ...${JSON.stringify(fmt)} } })), { noUndo: true }); })()`;
const CASES = [
  ['page_none', 'page-l3', null],
  ['page_icon_only', 'page-l2', null],
  ['page_cover_only', 'page-l1', setFmt('page-l1', { page_icon: null })],
  ['page_icon_cover', 'page-l1', null],
];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const res = [];
for (const theme of ['light', 'dark']) for (const [name, pageId, js] of CASES) {
  const ref = `${REF}/B04_${name}_${theme}.png`;
  if (!fs.existsSync(ref)) continue;
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&idle=1&promo=1&expand=page-rea,page-l1,page-l2&theme=${theme}#/p/${pageId}`);
  await page.waitForFunction(() => window.__inkwellReady);
  if (js) await page.evaluate(js);
  await page.waitForTimeout(700);
  const ours = `${OUT}B04_${name}_${theme}.png`;
  await page.screenshot({ path: ours });
  const refWv = `${OUT}ref_B04_${name}_${theme}.png`;
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${ref}').convert('RGB').crop((0,36,1320,860)).save('${refWv}')`]);
  const out = execFileSync('python3', ['compare.py', refWv, ours, `${DOC}/B04_${name}_${theme}.png`, '270', '44', '1304', '824'], { cwd }).toString();
  const bb = (f, r) => execFileSync('python3', ['bbox.py', f, ...r, '90'], { cwd }).toString().trim();
  const regions = { icon: ['430', '44', '560', '250'], title: ['560', '130', '1150', '460'] };
  const geo = Object.entries(regions).map(([k, r]) => k + ': ref ' + bb(refWv, r) + ' / ours ' + bb(ours, r)).join(' ; ');
  res.push({ name: `${name}_${theme}`, mismatch: out.match(/([\d.]+)%/)[1], geo });
  console.log(name, theme, out.trim(), geo);
  await page.close();
}
fs.writeFileSync(`${OUT}b04.json`, JSON.stringify(res, null, 2));
await browser.close();
