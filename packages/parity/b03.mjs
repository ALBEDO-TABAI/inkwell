// B03 sidebar states: codex 1x window shots (36px tab bar) vs our webview (1320x824), driven by real input.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/B03';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const cwd = new URL('.', import.meta.url).pathname;
const drag = async (page, to) => {
  const r = await page.locator('.ink-sb-resizer').boundingBox();
  const x = r.x + r.width / 2, y = 400;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + ((to - x) * i) / 10, y);
  await page.mouse.up(); await page.mouse.move(800, 600);
};
const CASES = {
  default: async () => {},
  collapsed: async (p) => { await p.keyboard.press('Meta+Backslash'); await p.mouse.move(800, 600); },
  hover_peek: async (p) => { await p.keyboard.press('Meta+Backslash'); await p.mouse.move(400, 400); await p.mouse.move(4, 400, { steps: 8 }); },
  max: async (p) => drag(p, 900),
  min: async (p) => drag(p, 100),
  restored: async (p) => { await p.keyboard.press('Meta+Backslash'); await p.waitForTimeout(400); await p.keyboard.press('Meta+Backslash'); await p.mouse.move(800, 600); },
};
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const res = [];
const sbw = async (p) => p.evaluate(() => { const s = document.querySelector('.ink-sidebar'); if (!s) return 0; const r = s.getBoundingClientRect(); return `${r.x},${r.y},${r.width}x${r.height}`; });
for (const theme of ['light', 'dark']) for (const [name, act] of Object.entries(CASES)) {
  const ref = `${REF}/B03_sidebar_${name}_${theme}.png`;
  if (!fs.existsSync(ref)) continue;
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&promo=1&expand=page-rea,page-l1,page-l2&theme=${theme}#/p/page-rea`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.mouse.move(800, 600);
  await act(page);
  await page.waitForTimeout(800);
  const ours = `${OUT}B03_${name}_${theme}.png`;
  await page.screenshot({ path: ours });
  const refWv = `${OUT}ref_B03_${name}_${theme}.png`;
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${ref}').convert('RGB').crop((0,36,1320,860)).save('${refWv}')`]);
  const out = execFileSync('python3', ['compare.py', refWv, ours, `${DOC}/B03_${name}_${theme}.png`, '0', '0', '1320', '824', '--1x'], { cwd }).toString();
  const box = await sbw(page);
  res.push({ name: `${name}_${theme}`, mismatch: +out.match(/([\d.]+)%/)[1], sidebar: box });
  console.log(name, theme, out.trim(), 'sidebar', box);
  await page.close();
}
fs.writeFileSync(`${OUT}b03.json`, JSON.stringify(res, null, 2));
await browser.close();
