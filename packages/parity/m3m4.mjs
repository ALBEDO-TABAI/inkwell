import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const base = 'http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&theme=light';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await page.goto(base + '#/p/page-rea'); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400);
// find in page
await page.keyboard.press('Control+f'); await page.waitForTimeout(150);
await page.keyboard.type('the'); await page.waitForTimeout(300);
const cnt = await page.textContent('.ink-find-count'); ok(/^1\/\d+$/.test(cnt) && +cnt.split('/')[1] > 1, 'find shows n/m: ' + cnt);
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
ok((await page.textContent('.ink-find-count')).startsWith('2/'), 'Enter → next');
await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(150);
ok((await page.textContent('.ink-find-count')).startsWith('1/'), 'Shift+Enter → prev');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
ok(!(await page.$('.ink-find')), 'Esc closes find');
// lock
await page.evaluate(() => window.__ink.store.transact('lock', (tx) => tx.update('page-rea', (b) => ({ props: { ...b.props, locked: true } }))));
await page.waitForTimeout(200);
ok(await page.evaluate(() => [...document.querySelectorAll('.ink-main .ink-editable')].every((e) => e.getAttribute('contenteditable') === 'false')), 'locked page: editables read-only');
ok(await page.evaluate(() => document.querySelector('.ink-main .ink-title-editable').getAttribute('contenteditable') === 'false'), 'locked page: title read-only');
ok(!!(await page.$('.ink-locked-chip')), 'topbar shows 已锁定');
await page.click('.ink-locked-chip'); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.querySelector('.ink-main .ink-title-editable').getAttribute('contenteditable') === 'true'), 'clicking chip unlocks');
// db: peek, edit, sort, filter, group, new row, calc
await page.goto(base + '#/p/page-db'); await page.reload(); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400);
ok((await page.$$('.ink-tv-row')).length === 12, 'table renders 12 rows');
await page.hover('.ink-tv-row[data-row-id="row-02"]'); await page.click('.ink-tv-row[data-row-id="row-02"] .ink-tv-open'); await page.waitForTimeout(300);
ok(!!(await page.$('.ink-peek-side')), 'open → side peek');
ok((await page.textContent('.ink-peek .ink-title-editable')) === 'Task 02', 'peek title');
ok((await page.$$('.ink-peek .ink-rowprop')).length === 13, 'peek lists 13 properties');
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
ok(!(await page.$('.ink-peek')), 'Esc closes peek');
await page.click('.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="notes"]'); await page.waitForTimeout(200);
await page.keyboard.press('End'); await page.keyboard.type(' Edited'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
ok((await page.textContent('.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="notes"]')).includes('Edited'), 'text cell edit');
await page.click('.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="category"]'); await page.waitForTimeout(200);
await page.keyboard.type('Delta'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
ok((await page.textContent('.ink-tv-row[data-row-id="row-01"] .ink-tv-cell[data-prop="category"]')) === 'Delta', 'select: create option');
await page.click('.ink-tv-row[data-row-id="row-02"] .ink-tv-cell[data-prop="done"]'); await page.waitForTimeout(150);
ok(await page.evaluate(() => window.__ink.store.get('row-02').props.done === true), 'checkbox toggles');
await page.click('.ink-tv-row[data-row-id="row-04"] .ink-tv-cell[data-prop="due"]'); await page.waitForTimeout(250);
ok(!!(await page.$('.ink-datepicker')), 'date picker opens');
await page.click('.ink-dp-day:not(.is-out) >> text="20"'); await page.waitForTimeout(150);
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
const due = await page.evaluate(() => window.__ink.store.get('row-04').props.due); ok(due.includes('2026-10-20'), 'date set: ' + JSON.stringify(due));
// sort desc via header menu
await page.click('.ink-tv-hcell[data-prop="score"]'); await page.waitForTimeout(200);
await page.hover('[data-item-id="sort"]'); await page.waitForTimeout(250); await page.click('[data-item-id="desc"]'); await page.waitForTimeout(200);
ok((await page.$$eval('.ink-tv-row', (rs) => rs.map((r) => r.dataset.rowId)))[0] === 'row-12', 'sort by score desc');
// calc
await page.click('.ink-tv-hcell[data-prop="score"]'); await page.waitForTimeout(200);
await page.hover('[data-item-id="calc"]'); await page.waitForTimeout(250); await page.hover('[data-item-id="more"]'); await page.waitForTimeout(250); await page.click('[data-item-id="sum"]'); await page.waitForTimeout(200);
ok((await page.textContent('.ink-tv-calc-cell.is-set')).includes('780'), 'calc sum 780');
// filter status is 完成
await page.evaluate(() => { const s = window.__ink.store; s.transact('f', (tx) => tx.update('page-db', (b) => ({ props: { ...b.props, views: b.props.views.map((v) => v.id === 'view-0' ? { ...v, filter: [{ prop: 'status', op: 'is', value: ['完成'] }] } : v) } }))); });
await page.waitForTimeout(200);
ok((await page.$$('.ink-tv-row')).length === 4, 'filter status=完成 → 4 rows');
// group by category
await page.evaluate(() => { const s = window.__ink.store; s.transact('g', (tx) => tx.update('page-db', (b) => ({ props: { ...b.props, views: b.props.views.map((v) => v.id === 'view-0' ? { ...v, filter: [], group: 'category' } : v) } }))); });
await page.waitForTimeout(200);
ok((await page.$$('.ink-tv-group')).length >= 3, 'group by category: ' + (await page.$$('.ink-tv-group')).length + ' groups');
// formula
ok(await page.evaluate(() => document.querySelector('.ink-tv-row[data-row-id="row-03"] .ink-tv-cell[data-prop="double"]')?.textContent === '60'), 'formula prop("Score")*2');
// board drag/new + gallery center peek
await page.evaluate(() => window.__ink.setActiveView('page-db', 'view-3')); await page.waitForTimeout(200);
await page.click('.ink-gv-card[data-row-id="row-05"]'); await page.waitForTimeout(300);
ok(!!(await page.$('.ink-peek-center')), 'gallery opens center peek');
await page.mouse.click(30, 400); await page.waitForTimeout(200);
ok(!(await page.$('.ink-peek')), 'scrim click closes center peek');
// alt+click page link → side peek
await page.goto(base + '#/p/page-rea'); await page.reload(); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400);
const link = await page.$('.ink-pagelink'); if (link) { await link.click({ modifiers: ['Alt'] }); await page.waitForTimeout(300); ok(!!(await page.$('.ink-peek-side')), 'Alt+click page link → side peek'); } else ok(false, 'no page link on page-rea');

// [[ / @ mentions, back/forward
await page.goto(base + '#/p/page-rea'); await page.reload(); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400);
const H = '.ink-main .ink-page-blocks > [data-type="header"] [data-editable-id]';
const newBlock = async () => { await page.click(H); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.waitForTimeout(150); };
await newBlock(); await page.keyboard.type('[['); await page.waitForTimeout(300);
ok(!!(await page.$('.ink-mention-menu')), '[[ opens the page-link menu');
await page.keyboard.type('L2'); await page.waitForTimeout(250); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
ok(await page.evaluate(() => !![...document.querySelectorAll('.ink-main .ink-mention')].some((m) => JSON.parse(m.dataset.mention).kind === 'page')), '[[ inserts a page mention');
await newBlock(); await page.keyboard.type('@today'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
ok(await page.evaluate(() => [...document.querySelectorAll('.ink-main .ink-mention')].some((m) => JSON.parse(m.dataset.mention).kind === 'date')), '@today inserts a date mention');
await page.evaluate(() => window.__ink.navigate('page-l1')); await page.waitForTimeout(300);
await page.evaluate(() => window.__ink.navigate('page-db')); await page.waitForTimeout(300);
await page.keyboard.press('Control+['); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__ink.getUi().pageId === 'page-l1'), 'Cmd+[ goes back');
await page.keyboard.press('Control+['); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__ink.getUi().pageId === 'page-rea'), 'back again');
await page.keyboard.press('Control+]'); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__ink.getUi().pageId === 'page-l1'), 'Cmd+] goes forward');

// version history: restore an older snapshot
await page.goto(base + '#/p/page-rea'); await page.reload(); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400);
await page.evaluate(async () => { const h = await import('/src/app/history.ts'); const s = window.__ink.store; const id = s.get('page-rea').content.at(-1); h.record('page-rea', Date.now() - 600000); s.transact('e', (tx) => tx.update(id, { title: [['CHANGED']] })); h.record('page-rea'); });
await page.click('.ink-more-btn'); await page.waitForTimeout(300); await page.click('[data-item-id="history"]'); await page.waitForTimeout(400);
ok((await page.$$('.ink-hist-item')).length >= 2, 'history lists versions');
await page.click('.ink-hist-item >> nth=1'); await page.waitForTimeout(200);
await page.click('.ink-hist-restore'); await page.waitForTimeout(300);
ok(await page.evaluate(() => { const s = window.__ink.store; const id = s.get('page-rea').content.at(-1); return JSON.stringify(s.get(id).title) !== '[["CHANGED"]]'; }), 'restore brings back the older text');
// slash inline database
ok(errs.length === 0, 'no page errors ' + errs.join('; '));
await browser.close();
