// B05b editor menus: reproduce each state, crop our popovers, and pair with the reference crop (cdp 2x shots).
// Reference shots were taken at varying scroll offsets, so pairs are aligned on the menu, not the page.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/B05b';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const PARA = '.ink-page-blocks > [data-type="text"]';
// reference menu crop boxes, css px (located by eye on the 2x shots)
const REFBOX = {
  slash_menu_top: [420, 240, 800, 640], slash_menu_scrolled: [420, 240, 800, 640], slash_filter: [410, 280, 780, 620],
  inline_toolbar: [540, 430, 790, 760], inline_color_menu: [520, 400, 800, 800], link_popover: [330, 400, 780, 770],
  link_hover: [640, 390, 960, 480], mention_menu: [410, 230, 790, 620], emoji_inline: [410, 200, 860, 370],
  emoji_picker_full: [250, 0, 740, 420], drag_in_progress: [380, 300, 1100, 560],
};
const newLine = async (p) => {
  const H = '.ink-page-blocks > [data-type="header"]';
  const hr = await p.evaluate((s) => { const el = document.querySelector(s + ' [data-editable-id]'); el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.right - 5, y: b.y + b.height / 2 }; }, H);
  await p.waitForTimeout(150);
  await p.mouse.click(hr.x, hr.y); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
};
const wordRect = (p, word, sel = PARA) => p.evaluate(([w, s]) => {
  const root = document.querySelector(s + ' [data-editable-id]');
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = it.nextNode())) { const i = n.data.indexOf(w); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } }
  return null;
}, [word, sel]);
const top = async (p) => { await p.evaluate((s) => { const el = document.querySelector(s); document.querySelector('.ink-scroller').scrollTop += el.getBoundingClientRect().y - 300; }, PARA); await p.waitForTimeout(150); };
const CASES = {
  slash_menu_top: async (p) => { await newLine(p); await p.keyboard.type('/'); },
  slash_menu_scrolled: async (p) => { await newLine(p); await p.keyboard.type('/'); await p.waitForTimeout(200); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowDown'); },
  slash_filter: async (p) => { await newLine(p); await p.keyboard.type('/to'); },
  inline_toolbar: async (p) => { await top(p); const w = await wordRect(p, 'plain'); await p.mouse.dblclick(w.x, w.y); },
  inline_color_menu: async (p) => { await top(p); const w = await wordRect(p, 'plain'); await p.mouse.dblclick(w.x, w.y); await p.waitForTimeout(300); await p.click('.ink-tb-color'); },
  link_popover: async (p) => { await top(p); const w = await wordRect(p, 'plain'); await p.mouse.dblclick(w.x, w.y); await p.waitForTimeout(200); await p.keyboard.press('Meta+k'); },
  link_hover: async (p) => { await top(p); const a = await p.evaluate((s) => { const b = document.querySelector(s + ' a').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, PARA); await p.mouse.move(a.x, a.y, { steps: 4 }); await p.waitForTimeout(900); },
  mention_menu: async (p) => { await newLine(p); await p.keyboard.type('@'); },
  emoji_inline: async (p) => { await newLine(p); await p.keyboard.type(':smi'); },
  emoji_picker_full: async (p) => { await p.evaluate(() => document.querySelector('.ink-callout-icon').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); await p.click('.ink-callout-icon'); },
  drag_in_progress: async (p) => {
    await top(p); const r = await p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + 100, y: b.y + 12 }; }, PARA);
    await p.mouse.move(r.x, r.y); await p.waitForTimeout(200);
    const h = await p.evaluate(() => { const b = document.querySelector('.ink-block-handle').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move(h.x + 5, h.y + 5, { steps: 3 }); await p.mouse.move(h.x + 200, h.y + 150, { steps: 12 });
    return 'nopop';
  },
};
const res = [];
for (const theme of ['light', 'dark']) for (const [name, act] of Object.entries(CASES)) {
  if (only && only !== name) continue;
  const ref = `${REF}/B05b_${name}_${theme}.png`;
  if (!fs.existsSync(ref)) continue;
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&idle=1&theme=${theme}#/p/page-rea`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.mouse.move(1300, 800);
  const mode = await act(page);
  await page.waitForTimeout(500);
  const ours = `${OUT}B05b_${name}_${theme}.png`;
  await page.screenshot({ path: ours });
  // our popover union (or the reference box for drag)
  const box = mode === 'nopop' ? null : await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-popover-id]')].filter((e) => e.getAttribute('data-popover-id') !== 'tooltip');
    if (!els.length) return null; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of els) { const b = (e.firstElementChild || e).getBoundingClientRect(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
  const rb = REFBOX[name];
  const ob = box ? [box.x - 20, box.y - 20, box.x + box.w + 20, box.y + box.h + 20] : rb;
  const py = `
from PIL import Image
a=Image.open('${ref}').convert('RGB'); b=Image.open('${ours}').convert('RGB')
s=a.size[0]/1320
ca=a.crop(tuple(int(v*s) for v in ${JSON.stringify(rb)})); cb=b.crop(tuple(int(max(0,v)*2) for v in ${JSON.stringify(ob)}))
H=max(ca.height,cb.height); im=Image.new('RGB',(ca.width+cb.width+20,H),(128,128,128)); im.paste(ca,(0,0)); im.paste(cb,(ca.width+20,0))
im=im.resize((im.width//2,im.height//2), Image.LANCZOS); im.save('${DOC}/B05b_${name}_${theme}.png')`;
  execFileSync('python3', ['-c', py]);
  res.push({ name: `${name}_${theme}`, ours: box });
  console.log(name, theme, JSON.stringify(box));
  await page.close();
}
fs.writeFileSync(`${OUT}b05b${only ? '_' + only : ''}.json`, JSON.stringify(res, null, 2));
await browser.close();
