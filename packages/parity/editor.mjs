// Editor/menu parity: reproduces interaction states and compares rects with the reference computed captures.
import { chromium } from 'playwright';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/computed';
const theme = process.argv[2] || 'light';
const ed = JSON.parse(fs.readFileSync(`${REF}/editor_${theme}.json`));
const mn = JSON.parse(fs.readFileSync(`${REF}/menus_${theme}.json`));
const OUT = new URL('./out/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const rows = [];
const R = (o) => ({ x: o.x, y: o.y, w: o.w, h: o.h });
const fmt = (o, ks) => ks.map((k) => `${k}=${+(+o[k]).toFixed(2)}`).join(' ');
function cmp(name, ref, ours, keys = ['x', 'y', 'w', 'h']) {
  if (!ref || !ours) { rows.push([name, ref ? fmt(ref, keys) : '—', ours ? fmt(ours, keys) : 'missing', '❌']); return; }
  const d = keys.map((k) => +(ours[k] - ref[k]).toFixed(2));
  const worst = Math.max(...d.map(Math.abs));
  rows.push([name, fmt(ref, keys), fmt(ours, keys), (worst <= 1 ? '✅ ' : '❌ ') + keys.map((k, i) => `${k}${d[i] >= 0 ? '+' : ''}${d[i]}`).join(' ')]);
}
async function fresh(hash = 'page-rea', extra = '') {
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&theme=${theme}${extra}#/p/${hash}`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.waitForTimeout(400);
  return page;
}
const rect = (page, sel, i = 0) => page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, [sel, i]);
// scroll so that a block's top lands at a given y
async function placeBlock(page, sel, y) {
  await page.evaluate(([s, y]) => { const el = document.querySelector(s); const sc = document.querySelector('.ink-scroller'); sc.scrollTop += el.getBoundingClientRect().y - y; }, [sel, y]);
  await page.waitForTimeout(150);
}
const PARA = '.ink-page-blocks > [data-type="text"]';

/* 1. block hover: handle + plus relative to the block (ref paragraph at y=387) */
{
  const page = await fresh();
  await placeBlock(page, PARA, 387);
  const b = await rect(page, PARA);
  await page.mouse.move(b.x + 200, b.y + 20);
  await page.waitForTimeout(300);
  cmp('hover: block', { x: 435, y: 387, w: 720, h: 88 }, b);
  cmp('hover: drag handle', R(ed.blockHover.buttons[8].rect), await rect(page, '.ink-block-handle'));
  cmp('hover: + button', R(ed.blockHover.buttons[9].rect), await rect(page, '.ink-plus'));
  await page.screenshot({ path: `${OUT}ed_hover_${theme}.png` });
  /* 2. block menu from handle click */
  const h = await rect(page, '.ink-block-handle');
  await page.mouse.click(h.x + h.w / 2, h.y + h.h / 2);
  await page.waitForTimeout(350);
  cmp('block menu: surface', R(mn.blockMenu.surfaces[0].rect), await rect(page, '.ink-menu'));
  cmp('block menu: search', R(mn.blockMenu.surfaces[1].rect), await rect(page, '.ink-menu .ink-menu-search'));
  for (let i = 0; i < 4; i++) cmp(`block menu: item ${i}`, R(mn.blockMenu.items[i].rect), await rect(page, '.ink-menu .ink-menu-item', i));
  cmp('block menu: selected overlay', R(mn.blockMenu.selectedBlockOverlay.rect), await rect(page, '.ink-block.is-selected > .ink-select-overlay, .ink-block.is-selected::after') || await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + 2, y: b.y + 2, w: b.width - 4, h: b.height - 4 }; }, '.ink-block.is-selected'));
  await page.screenshot({ path: `${OUT}ed_blockmenu_${theme}.png` });
  await page.close();
}
/* 3. slash menu: new empty block after Heading 1, editable placed at y=230 */
{
  const page = await fresh();
  const H = '.ink-page-blocks > [data-type="header"]';
  await placeBlock(page, H, 120);
  const hr = await rect(page, H + ' [data-editable-id]');
  await page.mouse.click(hr.x + hr.w - 5, hr.y + hr.h / 2);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const sel = '.ink-page-blocks > [data-type="header"] + [data-type="text"]';
  const e0 = await rect(page, sel + ' [data-editable-id]');
  await page.evaluate((dy) => { document.querySelector('.ink-scroller').scrollTop += dy; }, e0.y - 230);
  await page.waitForTimeout(100);
  cmp('empty block (placeholder state)', R(ed.emptyBlock.editable.rect), await rect(page, sel + ' [data-editable-id]'));
  await page.screenshot({ path: `${OUT}ed_empty_${theme}.png` });
  await page.keyboard.type('/');
  await page.waitForTimeout(400);
  const S = ed.slashMenu;
  cmp('slash: dialog', R(S.dialog[0].rect), await rect(page, '.ink-slash'));
  cmp('slash: scroll area', { ...R(S.scroll.rect), h: S.scroll.clientHeight }, await rect(page, '.ink-slash-scroll'));
  cmp('slash: label 0', R(S.sectionLabels[0][1].rect), await rect(page, '.ink-slash-label', 0));
  cmp('slash: label 1', R(S.sectionLabels[1][1].rect), await rect(page, '.ink-slash-label', 1));
  for (let i = 0; i < 4; i++) cmp(`slash: option ${i}`, R(S.options[i].rect), await rect(page, '.ink-slash-item', i));
  cmp('slash: option icon', R(S.options[0].children?.[1]?.rect || { x: S.options[0].rect.x + 8, y: S.options[0].rect.y + 6, w: 20, h: 20 }), await rect(page, '.ink-slash-icon', 0));
  cmp('slash: footer text', R(S.footer.rect), await rect(page, '.ink-slash-footer-row > span', 0));
  await page.screenshot({ path: `${OUT}ed_slash_${theme}.png` });
  await page.close();
}
/* 4. inline toolbar: select a word in the paragraph (ref selection 506.4,398 34.4x18) */
{
  const page = await fresh();
  await placeBlock(page, PARA, 387);
  const r = await page.evaluate((s) => {
    const ed = document.querySelector(s + ' [data-editable-id]');
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); const n = walker.nextNode();
    const i = n.textContent.indexOf('plain'); const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 5);
    const b = rg.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, PARA);
  await page.mouse.move(r.x + 1, r.y + r.h / 2); await page.mouse.down(); await page.mouse.move(r.x + r.w - 1, r.y + r.h / 2, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const ref = ed.inlineToolbar; const rs = ref.selection;
  const sur = await rect(page, '.ink-toolbar');
  cmp('toolbar: size', R(ref.surfaces[0].rect), sur, ['w', 'h']);
  cmp('toolbar: offset from selection end', { dx: ref.surfaces[0].rect.x - (rs.x + rs.w), dy: ref.surfaces[0].rect.y - (rs.y + rs.h) }, sur && { dx: sur.x - (r.x + r.w), dy: sur.y - (r.y + r.h) }, ['dx', 'dy']);
  for (const i of [0, 1, 5, 6, 11]) { const rb = ref.buttons[i].rect; const o = await rect(page, '.ink-toolbar [role="button"]', i); cmp(`toolbar: button ${i}`, { dx: rb.x - ref.surfaces[0].rect.x, dy: rb.y - ref.surfaces[0].rect.y, w: rb.w, h: rb.h }, o && sur && { dx: o.x - sur.x, dy: o.y - sur.y, w: o.w, h: o.h }, ['dx', 'dy', 'w', 'h']); }
  await page.screenshot({ path: `${OUT}ed_toolbar_${theme}.png` });
  await page.close();
}
/* 5. page ··· menu */
{
  const page = await fresh();
  await page.click('.ink-more-btn');
  await page.waitForTimeout(350);
  cmp('page menu: surface', R(mn.pageMenu.surfaces[0].rect), await rect(page, '.ink-menu'));
  cmp('page menu: search', R(mn.pageMenu.surfaces[1].rect), await rect(page, '.ink-menu .ink-menu-search'));
  for (let i = 0; i < 3; i++) cmp(`page menu: item ${i}`, R(mn.pageMenu.items[i].rect), await rect(page, '.ink-menu .ink-menu-item', i));
  await page.screenshot({ path: `${OUT}ed_pagemenu_${theme}.png` });
  await page.close();
}
/* 6. search modal */
{
  const page = await fresh();
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(400);
  const M = ed.searchModal;
  cmp('search: surface', R(M.surfaces[0].rect), await rect(page, '.ink-search'));
  cmp('search: input', R(M.input[0].rect), await rect(page, '.ink-search-head input'));
  for (let i = 0; i < 3; i++) cmp(`search: row ${i}`, R(M.options[i].rect), await rect(page, '.ink-search-row', i));
  await page.screenshot({ path: `${OUT}ed_search_${theme}.png` });
  await page.close();
}
const ok = rows.filter((x) => x[3].startsWith('✅')).length;
const md = `### Editor & menus (${theme}) — ${ok}/${rows.length} within 1px\n\n| element | reference | ours | delta |\n|---|---|---|---|\n` + rows.map((x) => `| ${x.join(' | ')} |`).join('\n') + '\n';
fs.writeFileSync(`/workspace/inkwell/docs/parity/editor-${theme}.md`, md);
console.log(md);
await browser.close();
