// Behaviour checks for the round-5 features (gaps, M6, M7). Prints PASS/FAIL lines.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const base = 'http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&theme=light';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };
const go = async (hash, q = '') => { await page.goto(base + q + '#/p/' + hash); await page.reload(); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400); };
const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const T = {};
T.viewDrag = async () => {
  await go('page-db');
  const a = await box('.ink-main .ink-db-tab[data-view-id="view-1"]'), b = await box('.ink-main .ink-db-tab[data-view-id="view-2"]');
  await page.mouse.move(a.x + 10, a.y + a.h / 2); await page.mouse.down(); await page.mouse.move(a.x + 30, a.y + a.h / 2, { steps: 3 }); await page.mouse.move(b.x + b.w - 4, b.y + b.h / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  const order = await page.evaluate(() => window.__ink.store.get('page-db').props.views.map((v) => v.id).slice(0, 3).join(','));
  ok(order === 'view-0,view-2,view-1', 'drag Board tab after List: ' + order);
};
T.timelineScale = async () => {
  await go('page-db'); await page.evaluate(() => window.__ink.setActiveView('page-db', 'view-5')); await page.waitForTimeout(300);
  await page.click('.ink-tl-scale'); await page.waitForTimeout(200); await page.click('[data-item-id="sc-week"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__ink.store.get('page-db').props.views.find((v) => v.id === 'view-5').timelineScale === 'week') && (await page.textContent('.ink-tl-scale')).includes('周'), 'timeline scale → 周');
};
T.mentionGhost = async () => {
  await go('page-rea');
  await page.click('.ink-main .ink-page-blocks > [data-type="header"] [data-editable-id]'); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('@'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('.ink-slash-ph')?.textContent === '今天'), '@ shows the 今天 ghost placeholder');
  await page.keyboard.type('to'); await page.waitForTimeout(200);
  ok(!(await page.$('.ink-slash-ph')), 'ghost disappears once typing');
  await page.keyboard.press('Escape');
};
T.emojiUsage = async () => {
  await go('page-rea');
  const order = await page.evaluate(async () => { const m = await import('/src/editor/emoji-data.ts'); const before = m.searchEmoji('heart').slice(0, 3).map((e) => e.char); const pick = m.searchEmoji('heart')[5].char; m.pushRecentEmoji(pick); m.pushRecentEmoji(pick); return [before[0], m.searchEmoji('heart')[0].char, pick]; });
  ok(order[1] === order[2] && order[0] !== order[2], 'emoji search ranks the most-used match first');
};
T.fileProp = async () => {
  await go('page-db', '&sidebar=closed');
  const fp = await page.evaluate(async () => { const m = await import('/src/db/model.ts'); const v = m.viewsOf(window.__ink.store.get('page-db'))[0]; return m.addProp('page-db', 'file', { name: 'Files', at: { viewId: v.id, after: 'title' } }); });
  await page.waitForTimeout(200);
  await page.click(`.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="${fp}"]`); await page.waitForTimeout(300);
  ok(!!(await page.$('.ink-file-editor')), 'files editor opens');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('.ink-file-editor input[type=file]', [{ name: 'cover.png', mimeType: 'image/png', buffer: png }, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);
  await page.waitForTimeout(400);
  ok((await page.$$('.ink-file-editor .ink-file-row')).length === 2, 'two files attached');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(!!(await page.$(`.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="${fp}"] img.ink-file-thumb`)) && (await page.textContent(`.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="${fp}"]`)).includes('notes.txt'), 'cell shows thumbnail + file chip');
  await page.evaluate(() => window.__ink.setActiveView('page-db', 'view-3')); await page.waitForTimeout(300);
  ok(!!(await page.$('.ink-gv-card[data-row-id="row-01"] .ink-gv-cover img')), 'gallery card uses the image as its cover');
};
T.groupPanel = async () => {
  await go('page-db', '&sidebar=closed');
  await page.evaluate(async () => { const m = await import('/src/db/menus.tsx'); const db = window.__ink.store.get('page-db'); m.openGroupPanel(document.querySelector('.ink-main .ink-db-tools'), db, db.props.views[0]); });
  await page.waitForTimeout(300);
  await page.click('.ink-group-panel .ink-menu-item[data-prop="category"]'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-main .ink-tv-group')).length === 3, 'group by Category → 3 table groups');
  ok(!!(await page.$('.ink-group-panel .ink-gp-groups')), 'panel switches to the group options page');
  await page.click('.ink-gp-groups [data-group-key="Alpha"] .ink-gp-eye'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-main .ink-tv-group')).length === 2, 'hiding Alpha leaves 2 groups');
  await page.click('.ink-group-panel .ink-menu-item:has-text("排序")'); await page.waitForTimeout(200); await page.click('[data-item-id="gs-desc"]'); await page.waitForTimeout(300);
  const labels = await page.$$eval('.ink-main .ink-tv-group', (gs) => gs.map((g) => g.dataset.groupKey || g.querySelector('.ink-tag')?.textContent));
  ok(labels.join(',') === 'Gamma,Beta', 'groups sorted descending: ' + labels.join(','));
  await page.click('.ink-group-panel .ink-menu-item:has-text("显示聚合")'); await page.waitForTimeout(200);
  ok(!(await page.$('.ink-main .ink-tv-gcount')), 'counts hidden');
  await page.click('.ink-group-panel .ink-menu-item:has-text("删除分组")'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-main .ink-tv-group')).length === 0, 'remove grouping');
};
T.comments = async () => {
  await go('page-rea');
  // select the first 5 chars of the first paragraph and comment via the toolbar
  const sel = '.ink-main .ink-page-blocks > [data-type="text"] [data-editable-id]';
  const id = await page.$eval(sel, (el) => el.dataset.editableId);
  await page.evaluate(({ sel }) => { const el = document.querySelector(sel); el.focus(); window.__ink.focusBlock(el.dataset.editableId, { start: 0, end: 4 }); }, { sel });
  await page.evaluate(async ({ id }) => { const m = await import('/src/comments/Comments.tsx'); m.commentOnSelection(id, 0, 4); }, { id });
  await page.waitForTimeout(200);
  await page.keyboard.type('第一条评论'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  ok(!!(await page.$(sel + ' .ink-cm')), 'inline comment highlights the text');
  await page.click(sel + ' .ink-cm'); await page.waitForTimeout(300);
  ok((await page.textContent('.ink-cm-card')).includes('第一条评论'), 'clicking the highlight opens the thread');
  await page.click('.ink-cm-card textarea'); await page.keyboard.type('回复一下'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-cm-card .ink-cm-item')).length === 2, 'reply adds a second comment');
  await page.hover('.ink-cm-card .ink-cm-item'); await page.click('.ink-cm-card .ink-cm-act[aria-label="解决"]'); await page.waitForTimeout(300);
  ok(!(await page.$(sel + ' .ink-cm')), 'resolving removes the highlight');
  await page.keyboard.press('Escape');
  // page-level comment
  await page.evaluate(async () => { const m = await import('/src/comments/Comments.tsx'); m.addPageComment('page-rea'); }); await page.waitForTimeout(200);
  await page.keyboard.type('页面评论'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  ok((await page.textContent('.ink-page-comments')).includes('页面评论'), 'page-level comment under the title');
  ok(!!(await page.$('.ink-topbar .ink-cm-toggle')), 'topbar shows the comments button');
  await page.click('.ink-topbar .ink-cm-toggle'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-rpanel .ink-rp-thread')).length === 1, 'comments sidebar lists the open thread');
  await page.click('.ink-rp-chip'); await page.click('[data-item-id="f-resolved"]'); await page.waitForTimeout(200);
  ok((await page.$$('.ink-rpanel .ink-rp-thread')).length === 1 && (await page.textContent('.ink-rpanel')).includes('Thi'), 'resolved filter shows the inline thread with its quote');
  await page.evaluate(() => window.__ink.setUi({ rightPanel: 'updates' })); await page.waitForTimeout(300);
  ok((await page.$$('.ink-rpanel .ink-up-entry')).length >= 1, 'updates panel lists entries');
};
T.media = async () => {
  await go('page-rea');
  const id = await page.evaluate(() => [...window.__ink.store.blocks.values()].find((b) => b.type === 'image' && b.alive !== false).id);
  const sel = `.ink-main [data-block-id="${id}"] .ink-media-box`;
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await page.waitForTimeout(300);
  const b0 = await box(sel); await page.mouse.move(b0.x + b0.w / 2, b0.y + b0.h / 2); await page.waitForTimeout(200);
  const h = await box(sel + ' .ink-rs-handle.is-right');
  await page.mouse.move(h.x + 7, h.y + h.h / 2); await page.mouse.down(); await page.mouse.move(h.x - 100, h.y + h.h / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  const w = await page.evaluate((i) => window.__ink.store.get(i).format.image_width, id);
  ok(w && Math.abs(w - (b0.w - 214)) < 6, `centred image resizes symmetrically: ${b0.w.toFixed(0)} → ${w}`);
  await page.mouse.move(b0.x + b0.w / 2, b0.y + 50); await page.waitForTimeout(200);
  await page.click(sel + ' .ink-mtb-btn[aria-label="对齐"]'); await page.click('[data-item-id="al-left"]'); await page.waitForTimeout(200);
  const b1 = await box(sel); ok(Math.abs(b1.x - b0.x) < 3, 'align left moves the image to the left edge');
  await page.mouse.move(b1.x + 50, b1.y + 50); await page.waitForTimeout(150);
  await page.click(sel + ' .ink-mtb-btn[aria-label="说明"]'); await page.waitForTimeout(200); await page.keyboard.type('图片说明'); await page.waitForTimeout(400);
  ok(await page.evaluate((i) => (window.__ink.store.get(i).props.caption || []).map((x) => x[0]).join('') === '图片说明', id), 'caption is editable');
  await page.screenshot({ path: 'out/r5_image.png' });
  // file / audio / pdf blocks
  const ids = await page.evaluate(() => { const s = window.__ink.store; const out = []; for (const [type, p] of [['file', { url: 'data:text/plain;base64,aGVsbG8=', fileName: '笔记.txt', fileSize: 5 }], ['audio', { url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' }], ['pdf', {}]]) { const id = 'x-' + type; s.transact('t', (tx) => { tx.create({ id, type, title: [], parent: 'page-rea', parentTable: 'block', content: [], alive: true, props: p }); tx.insertChild('page-rea', id, 0); }); out.push(id); } return out; });
  await page.waitForTimeout(300);
  ok(await page.textContent(`[data-block-id="x-file"] .ink-fileblock-row`).then((x) => x.includes('笔记.txt') && x.includes('5 B')), 'file block shows name and size');
  ok(!!(await page.$('[data-block-id="x-audio"] audio')), 'audio block renders a player');
  ok(!!(await page.$('[data-block-id="x-pdf"] .ink-media-empty')), 'empty pdf block shows the upload placeholder');
  void ids;
};
T.tabs = async () => {
  await go('page-rea');
  await page.click('.ink-main .ink-page-blocks > [data-type="header"] [data-editable-id]'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.keyboard.type('/标签页'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  ok((await page.$$('.ink-main .ink-tabsblock .ink-tabs-tab')).length === 2, 'slash /标签页 creates a 2-tab block');
  await page.keyboard.type('第一页内容'); await page.waitForTimeout(200);
  await page.click('.ink-main .ink-tabsblock .ink-tabs-tab >> nth=1'); await page.waitForTimeout(300);
  ok(!(await page.textContent('.ink-main .ink-tabs-panel')).includes('第一页内容'), 'switching tabs swaps the panel');
  await page.click('.ink-main .ink-tabsblock .ink-tabs-add'); await page.waitForTimeout(300);
  ok((await page.$$('.ink-main .ink-tabsblock .ink-tabs-tab')).length === 3, 'add tab');
  await page.click('.ink-main .ink-tabsblock .ink-tabs-tab >> nth=0'); await page.waitForTimeout(300);
  ok((await page.textContent('.ink-main .ink-tabs-panel')).includes('第一页内容'), 'first tab keeps its content');
  await page.screenshot({ path: 'out/r5_tabs.png' });
};
const only = process.argv[2];
for (const [k, f] of Object.entries(T)) { if (only && !k.includes(only)) continue; try { await f(); } catch (e) { ok(false, k + ' threw ' + e.message.split('\n')[0]); } }
ok(errs.length === 0, 'no page errors ' + errs.join('; '));
console.log(`round5: ${pass}/${pass + fail}`);
await browser.close();
