// Interaction smoke tests: each step asserts DOM state; prints PASS/FAIL lines.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const results = [];
const errors = [];
async function fresh(hash = 'page-rea') {
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1#/p/${hash}`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.waitForTimeout(300);
  return page;
}
async function test(name, fn) {
  const page = await fresh();
  try { const r = await fn(page); results.push([r === false ? 'FAIL' : 'PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message.split('\n')[0]]); await page.screenshot({ path: `out/smoke_fail_${name.replace(/\W+/g, '_')}.png` }); }
  await page.close();
}
const count = (p, sel) => p.evaluate((s) => document.querySelectorAll(s).length, sel);
async function newBlockAfterH1(page) {
  const H = '.ink-page-blocks > [data-type="header"] [data-editable-id]';
  await page.click(H); await page.keyboard.press('End'); await page.keyboard.press('Enter');
}
async function expect(cond, msg) { if (!cond) throw new Error(msg); }

await test('slash → image → embed link', async (p) => {
  await newBlockAfterH1(p);
  await p.keyboard.type('/image'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await expect(await count(p, '.ink-media-pop'), 'media popover not open');
  await p.click('.ink-media-tab:nth-child(2)');
  await p.fill('.ink-media-input', 'https://example.com/a.png'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  await expect(await p.evaluate(() => [...document.querySelectorAll('[data-type="image"] img')].some((i) => i.src === 'https://example.com/a.png')), 'image not set');
});
await test('slash → bookmark', async (p) => {
  await newBlockAfterH1(p);
  await p.keyboard.type('/bookmark'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.fill('.ink-media-input', 'inkwell.dev'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  await expect(await p.evaluate(() => [...document.querySelectorAll('.ink-bookmark-title')].some((e) => e.textContent === 'inkwell.dev')), 'bookmark missing');
});
await test('slash → html embed', async (p) => {
  await newBlockAfterH1(p);
  await p.keyboard.type('/html'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.fill('.ink-media-input', '<b>hi</b>'); await p.click('.ink-media-pop .ink-btn-primary'); await p.waitForTimeout(200);
  await expect(await count(p, '.ink-embed iframe'), 'iframe missing');
});
await test('markdown shortcuts', async (p) => {
  await newBlockAfterH1(p);
  await p.keyboard.type('## Title'); await p.keyboard.press('Enter');
  await p.keyboard.type('- item'); await p.keyboard.press('Enter'); await p.keyboard.type('next'); await p.keyboard.press('Tab');
  await p.waitForTimeout(150);
  const types = await p.evaluate(() => { const h = document.querySelector('.ink-page-blocks > [data-type="header"]'); const a = h.nextElementSibling; const b = a.nextElementSibling; return [a.dataset.type, b.dataset.type, b.querySelectorAll('[data-type="bulleted_list"]').length]; });
  await expect(types[0] === 'sub_header' && types[1] === 'bulleted_list' && types[2] === 1, 'got ' + types.join(','));
});
await test('undo / redo typing', async (p) => {
  await newBlockAfterH1(p); await p.keyboard.type('hello'); await p.waitForTimeout(700);
  await p.keyboard.press('Meta+z'); await p.waitForTimeout(150);
  const t1 = await p.evaluate(() => document.querySelector('.ink-page-blocks > [data-type="header"] + *')?.textContent);
  await p.keyboard.press('Meta+Shift+z'); await p.waitForTimeout(150);
  const t2 = await p.evaluate(() => document.querySelector('.ink-page-blocks > [data-type="header"] + *')?.textContent);
  await expect(t1 !== 'hello' && t2 === 'hello', `undo=${t1} redo=${t2}`);
});
await test('block selection via Esc + delete', async (p) => {
  await newBlockAfterH1(p); await p.keyboard.type('to delete'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await expect(await count(p, '.ink-block.is-selected') === 1, 'not selected');
  await p.keyboard.press('Backspace'); await p.waitForTimeout(100);
  await expect(!(await p.evaluate(() => document.body.innerText.includes('to delete'))), 'not deleted');
});
await test('Cmd+\\ collapses sidebar', async (p) => {
  await p.keyboard.press('Meta+\\'); await p.waitForTimeout(400);
  await expect(await count(p, '.ink-app.sb-closed'), 'sidebar still open');
});
await test('Cmd+Shift+L toggles dark', async (p) => {
  await p.keyboard.press('Meta+Shift+l'); await p.waitForTimeout(200);
  await expect(await p.evaluate(() => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'), 'not dark');
});
await test('inline toolbar bold', async (p) => {
  const sel = await p.evaluate(() => { const ed = document.querySelector('.ink-page-blocks > [data-type="text"] [data-editable-id]'); const n = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT).nextNode(); const i = n.textContent.indexOf('plain'); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await p.mouse.move(sel.x + 1, sel.y + sel.h / 2); await p.mouse.down(); await p.mouse.move(sel.x + sel.w - 1, sel.y + sel.h / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
  await expect(await count(p, '.ink-toolbar'), 'toolbar not shown');
  await p.keyboard.press('Meta+b'); await p.waitForTimeout(150);
  await expect(await p.evaluate(() => [...document.querySelectorAll('.ink-page-blocks > [data-type="text"] b, .ink-page-blocks > [data-type="text"] .ink-b, .ink-page-blocks > [data-type="text"] strong')].some((e) => e.textContent === 'plain')), 'not bold');
});
await test('Cmd+K link popover on selection', async (p) => {
  const sel = await p.evaluate(() => { const ed = document.querySelector('.ink-page-blocks > [data-type="text"] [data-editable-id]'); const n = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT).nextNode(); const i = n.textContent.indexOf('plain'); const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 5); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await p.mouse.move(sel.x + 1, sel.y + sel.h / 2); await p.mouse.down(); await p.mouse.move(sel.x + sel.w - 1, sel.y + sel.h / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(200);
  await p.keyboard.press('Meta+k'); await p.waitForTimeout(300);
  await expect(await count(p, '.ink-link-pop, .ink-linkpop, [data-pop-id="link"]'), 'no link popover');
});
await test('@ mention menu', async (p) => { await newBlockAfterH1(p); await p.keyboard.type('@'); await p.waitForTimeout(300); await expect(await count(p, '.ink-mention-menu'), 'no mention menu'); });
await test(': emoji inline', async (p) => { await newBlockAfterH1(p); await p.keyboard.type(':smi'); await p.waitForTimeout(300); await expect(await count(p, '.ink-emoji-inline, .ink-inline-emoji'), 'no emoji menu'); });
await test('page ··· menu opens', async (p) => { await p.click('.ink-more-btn'); await p.waitForTimeout(250); await expect(await count(p, '.ink-menu'), 'no menu'); });
await test('settings modal Cmd+,', async (p) => { await p.keyboard.press('Meta+,'); await p.waitForTimeout(300); await expect(await count(p, '.ink-settings'), 'no settings'); });
await test('add icon via header control', async (p) => {
  await p.goto('http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1#/p/page-l3'); await p.waitForTimeout(400);
  await p.hover('.ink-page-title'); await p.waitForTimeout(100);
  await p.click('.ink-page-controls [role="button"]:first-child, .ink-page-controls button:first-child'); await p.waitForTimeout(300);
  await expect(await count(p, '.ink-page-icon'), 'no icon');
});
await test('drag block moves it', async (p) => {
  const blocks = await p.evaluate(() => [...document.querySelectorAll('.ink-page-blocks > [data-block-id]')].slice(0, 6).map((e) => e.dataset.blockId));
  const src = `[data-block-id="${blocks[1]}"]`;
  const r = await p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, h: b.height }; }, src);
  await p.mouse.move(r.x + 100, r.y + 15); await p.waitForTimeout(150);
  const h = await p.evaluate(() => { const b = document.querySelector('.ink-block-handle').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const tgt = await p.evaluate((id) => { const b = document.querySelector(`[data-block-id="${id}"]`).getBoundingClientRect(); return { x: b.x + 200, y: b.y + b.height - 3 }; }, blocks[4]);
  await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move(h.x + 5, h.y + 5, { steps: 3 }); await p.mouse.move(tgt.x, tgt.y, { steps: 12 }); await p.waitForTimeout(150); await p.mouse.move(tgt.x + 4, tgt.y, { steps: 2 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(300);
  const after = await p.evaluate(() => [...document.querySelectorAll('.ink-page-blocks > [data-block-id]')].slice(0, 6).map((e) => e.dataset.blockId));
  await expect(after.indexOf(blocks[1]) > after.indexOf(blocks[4]) || after.indexOf(blocks[1]) === -1 ? after.indexOf(blocks[1]) !== -1 : false, 'order ' + after.join(','));
});
console.log(results.map((r) => r.join('  ')).join('\n'));
console.log('errors:', [...new Set(errors)].slice(0, 10));
await browser.close();
