// B06 / B06b database views, peeks and menus: reference 1x webview shots (1320x824) vs ours at the same size.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const cwd = new URL('.', import.meta.url).pathname;
const only = process.argv[2];
const R = '/workspace/notion-research/ref';
const view = (id, extra = '') => `(() => { window.__ink.setActiveView('page-db', '${id}'); ${extra} })()`;
const gallery = (size) => view('view-3', `const s = window.__ink.store; s.transact('t', (tx) => tx.update('page-db', (b) => ({ props: { ...b.props, views: b.props.views.map((v) => v.id === 'view-3' ? { ...v, gallerySize: '${size}' } : v) } })), { noUndo: true });`);
const clickSel = (sel, i = 0, dx = 0.5, dy = 0.5) => async (page) => { const b = await page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, [sel, i]); if (!b) throw new Error('missing ' + sel); await page.mouse.click(b.x + b.w * dx, b.y + b.h * dy); await page.waitForTimeout(350); };
const cell = (row, prop) => `.ink-tv-row[data-row-id="${row}"] .ink-tv-cell[data-prop="${prop}"]`;
const hoverTitle = async (p) => { await p.hover('.ink-main .ink-title-editable'); await p.waitForTimeout(300); };
const B01C = (v, view_) => ({ ref: `B01c/B01c_db_${v}`, b01c: true, q: '&promo=1', js: view(view_), act: hoverTitle, keepMouse: true });
const CASES = {
  b01c_table: B01C('table', 'view-0'), b01c_board: B01C('board', 'view-1'), b01c_list: B01C('list', 'view-2'),
  b01c_gallery: B01C('gallery', 'view-3'), b01c_calendar: B01C('calendar', 'view-4'), b01c_timeline: B01C('timeline', 'view-5'),
  view_table: { ref: 'B06/1x/B06_view_table', js: view('view-0') },
  view_board: { ref: 'B06/1x/B06_view_board', js: view('view-1') },
  view_list: { ref: 'B06/1x/B06_view_list', js: view('view-2') },
  view_gallery_M: { ref: 'B06/1x/B06_view_gallery_M', js: gallery('M') },
  view_gallery_S: { ref: 'B06/1x/B06_view_gallery_S', js: gallery('S') },
  view_gallery_L: { ref: 'B06/1x/B06_view_gallery_L', js: gallery('L') },
  view_calendar: { ref: 'B06/1x/B06_view_calendar', js: view('view-4') },
  view_timeline: { ref: 'B06/1x/B06_view_timeline', js: view('view-5') },
  row_peek_from_table: { ref: 'B06/1x/B06_row_peek_from_table', q: '&sidebar=closed', js: `(() => { window.__ink.setActiveView('page-db', 'view-0'); window.__ink.openPeek('row-03', 'side'); })()` },
  row_peek_from_gallery: { ref: 'B06/1x/B06_row_peek_from_gallery', js: `(() => { window.__ink.setActiveView('page-db', 'view-3'); window.__ink.openPeek('row-01', 'center'); })()` },
  views_more_menu: { ref: 'B06/1x/B06_views_more_menu', js: view('view-4'), act: clickSel('.ink-db-tab.is-more') },
  header_menu: { ref: 'B06b/1x/B06b_property_header_menu', js: view('view-0'), act: clickSel('.ink-tv-hcell[data-prop="notes"]') },
  type_menu: { ref: 'B06b/1x/B06b_property_type_menu', js: view('view-0'), act: async (p) => { await clickSel('.ink-tv-hcell[data-prop="notes"]')(p); await clickSel('[data-item-id="type"]')(p); } },
  cell_select: { ref: 'B06b/1x/B06b_cell_select', js: view('view-0'), act: clickSel(cell('row-03', 'category')) },
  cell_multiselect: { ref: 'B06b/1x/B06b_cell_multiselect', js: view('view-0'), act: clickSel(cell('row-03', 'tags')) },
  cell_status: { ref: 'B06b/1x/B06b_cell_status', js: view('view-0'), act: clickSel(cell('row-03', 'status')) },
  cell_text: { ref: 'B06b/1x/B06b_cell_edit_text', js: view('view-0'), act: clickSel(cell('row-03', 'notes')) },
  filter_menu: { ref: 'B06b/1x/B06b_filter_menu', js: view('view-0'), act: clickSel('.ink-db-tool[aria-label="筛选"]') },
  sort_menu: { ref: 'B06b/1x/B06b_sort_menu', js: view('view-0'), act: clickSel('.ink-db-tool[aria-label="排序"]') },
  calc_menu: { ref: 'B06b/1x/B06b_calc_menu', js: view('view-0'), act: async (p) => { await clickSel('.ink-tv-hcell[data-prop="score"]')(p); await clickSel('[data-item-id="calc"]')(p); } },
};
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const res = [];
for (const theme of ['light', 'dark']) for (const [name, c] of Object.entries(CASES)) {
  if (only && !name.includes(only)) continue;
  let ref = c.b01c ? `${R}/${c.ref}_${theme}.png` : `${R}/${c.ref}_${theme}@1x.png`;
  if (!fs.existsSync(ref)) { console.log('no ref', ref); continue; }
  if (c.b01c) { const crop = `${OUT}ref_${name}_${theme}.png`; execFileSync('python3', ['-c', `from PIL import Image; Image.open('${ref}').convert('RGB').crop((0,36,1320,860)).save('${crop}')`]); ref = crop; }
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=${theme}${c.q || ''}#/p/page-db`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.waitForTimeout(300);
  if (c.js) await page.evaluate(c.js);
  await page.waitForTimeout(500);
  try { if (c.act) await c.act(page); } catch (e) { console.log(name, 'act failed', e.message); }
  if (!c.keepMouse) await page.mouse.move(1310, 815);
  await page.waitForTimeout(300);
  const ours = `${OUT}B06_${name}_${theme}.png`;
  await page.screenshot({ path: ours });
  const x0 = c.q?.includes('sidebar=closed') ? 0 : 270;
  const out = execFileSync('python3', ['compare.py', ref, ours, `${DOC}/B06_${name}_${theme}.png`, String(x0), '0', '1320', '824'], { cwd }).toString();
  res.push({ name: `${name}_${theme}`, mismatch: +out.match(/([\d.]+)%/)[1] });
  console.log(name, theme, out.trim());
  await page.close();
}
fs.writeFileSync(`${OUT}db.json`, JSON.stringify(res, null, 2));
await browser.close();
