// B07: page menu, trash (filtered "REA"), version history — reference 1x vs ours (1320x824)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const DOC = '/workspace/inkwell/docs/parity', OUT = new URL('./out/', import.meta.url).pathname, cwd = new URL('.', import.meta.url).pathname;
const seedHistory = async (p) => p.evaluate(async () => {
  const h = await import('/src/app/history.ts'); const s = window.__ink.store; const page = s.get('page-rea');
  const last = page.content[page.content.length - 1]; const orig = s.get(last).title; const now = Date.now();
  for (let i = 12; i >= 1; i--) { s.transact('e', (tx) => tx.update(last, { title: [...(orig || []), [' v' + i]] }), { noUndo: true }); h.record('page-rea', now - i * 420000 - (i % 3) * 61000); }
  s.transact('e', (tx) => tx.update(last, { title: orig }), { noUndo: true }); h.record('page-rea', now);
});
const only = process.argv[2];
const CASES = {
  page_menu: async (p) => { await p.click('.ink-more-btn'); },
  trash_filtered_REA: async (p) => { await p.evaluate(() => import('/src/shell/Trash.tsx').then((m) => m.openTrash())); await p.waitForTimeout(200); await p.keyboard.type('REA'); },
  help_menu: async (p) => { await p.click('.ink-sb-footer .ink-sb-iconbtn >> nth=0'); },
  help_more_submenu: async (p) => { await p.click('.ink-sb-footer .ink-sb-iconbtn >> nth=0'); await p.waitForTimeout(250); await p.hover('[data-item-id="more"]'); },
  library_menu: async (p) => { await p.click('.ink-sb-footer .ink-sb-iconbtn >> nth=1'); },
  shortcuts_modal: async (p) => { await p.evaluate(() => import('/src/shell/HelpMenus.tsx').then((m) => m.openShortcuts())); },
  updates_panel: async (p) => { await seedHistory(p); await p.evaluate(() => window.__ink.setUi({ rightPanel: 'updates' })); },
  page_history: async (p) => { await seedHistory(p); await p.click('.ink-more-btn'); await p.waitForTimeout(300); await p.click('[data-item-id="history"]'); },
};
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const res = [];
for (const theme of ['light', 'dark']) for (const [name, act] of Object.entries(CASES)) {
  if (only && !name.includes(only)) continue;
  const p = await b.newPage({ viewport: { width: 1320, height: 824 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&promo=1&theme=${theme}#/p/page-rea`); await p.waitForFunction(() => window.__inkwellReady); await p.waitForTimeout(500);
  await act(p); await p.waitForTimeout(600); await p.mouse.move(1310, 815);
  const ours = `${OUT}B07_${name}_${theme}.png`; await p.screenshot({ path: ours });
  const ref = `/workspace/notion-research/ref/B07/1x/B07_${name}_${theme}@1x.png`;
  const out = execFileSync('python3', ['compare.py', ref, ours, `${DOC}/B07_${name}_${theme}.png`, '0', '0', '1320', '824'], { cwd }).toString();
  res.push({ name: `${name}_${theme}`, mismatch: +out.match(/([\d.]+)%/)[1] }); console.log(name, theme, out.trim());
  await p.close();
}
fs.writeFileSync(`${OUT}b07.json`, JSON.stringify(res, null, 2));
await b.close();
