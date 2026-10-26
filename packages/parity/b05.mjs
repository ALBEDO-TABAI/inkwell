// B05 block interaction states: codex 1x window shots (36px tab bar) vs our webview, same paragraph placement as editor.mjs.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/B05';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const cwd = new URL('.', import.meta.url).pathname;
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const PARA = '.ink-page-blocks > [data-type="text"]';
const rect = (page, sel, i = 0) => page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, [sel, i]);
async function setup(page) {
  await page.evaluate(([s, y]) => { const el = document.querySelector(s); const sc = document.querySelector('.ink-scroller'); sc.scrollTop += el.getBoundingClientRect().y - y; }, [PARA, 387]);
  await page.waitForTimeout(150);
  return rect(page, PARA);
}
const itemByText = async (page, txt) => page.evaluate((t) => { const el = [...document.querySelectorAll('.ink-menu .ink-menu-item')].find((e) => e.textContent.trim().startsWith(t)); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, txt);
const openBlockMenu = async (page) => {
  const b = await setup(page);
  await page.mouse.move(b.x + 200, b.y + 20); await page.waitForTimeout(250);
  const h = await rect(page, '.ink-block-handle');
  await page.mouse.click(h.x + h.w / 2, h.y + h.h / 2); await page.waitForTimeout(350);
};
const CASES = {
  block_hover: async (p) => { const b = await setup(p); await p.mouse.move(1165, 360); await p.waitForTimeout(300); },
  block_handle_hover: async (p) => { const b = await setup(p); await p.mouse.move(b.x + 200, b.y + 20); await p.waitForTimeout(250); const h = await rect(p, '.ink-block-handle'); await p.mouse.move(h.x + h.w / 2, h.y + h.h / 2); await p.waitForTimeout(900); },
  block_menu: openBlockMenu,
  color_menu: async (p) => { await openBlockMenu(p); const r = await itemByText(p, '颜色'); await p.mouse.move(r.x + 40, r.y + r.h / 2); await p.waitForTimeout(600); },
  turn_into_menu: async (p) => { await openBlockMenu(p); const r = await itemByText(p, '转换成'); await p.mouse.move(r.x + 40, r.y + r.h / 2); await p.waitForTimeout(600); },
};
const res = [];
for (const theme of ['light', 'dark']) for (const [name, act] of Object.entries(CASES)) {
  if (only && only !== name) continue;
  const ref = `${REF}/B05_${name}_${theme}.png`;
  if (!fs.existsSync(ref)) continue;
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&idle=1&promo=1&expand=page-rea,page-l1,page-l2&theme=${theme}#/p/page-rea`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.mouse.move(1300, 800);
  await act(page);
  const ours = `${OUT}B05_${name}_${theme}.png`;
  await page.screenshot({ path: ours });
  const refWv = `${OUT}ref_B05_${name}_${theme}.png`;
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${ref}').convert('RGB').crop((0,36,1320,860)).save('${refWv}')`]);
  const out = execFileSync('python3', ['compare.py', refWv, ours, `${DOC}/B05_${name}_${theme}.png`, '270', '0', '1320', '824', '--1x'], { cwd }).toString();
  res.push({ name: `${name}_${theme}`, mismatch: +out.match(/([\d.]+)%/)[1] });
  console.log(name, theme, out.trim());
  await page.close();
}
fs.writeFileSync(`${OUT}b05${only ? '_' + only : ''}.json`, JSON.stringify(res, null, 2));
await browser.close();
