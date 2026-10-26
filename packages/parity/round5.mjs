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
const only = process.argv[2];
for (const [k, f] of Object.entries(T)) { if (only && !k.includes(only)) continue; try { await f(); } catch (e) { ok(false, k + ' threw ' + e.message.split('\n')[0]); } }
ok(errs.length === 0, 'no page errors ' + errs.join('; '));
console.log(`round5: ${pass}/${pass + fail}`);
await browser.close();
