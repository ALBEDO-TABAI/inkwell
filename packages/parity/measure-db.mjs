import { chromium } from 'playwright';
const [, , hash, theme = 'light', js = ''] = process.argv;
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=${theme}#/p/${hash}`);
await page.waitForFunction(() => window.__inkwellReady);
await page.waitForTimeout(500);
if (js) { await page.evaluate(js); await page.waitForTimeout(500); }
const r = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].slice(0, 3).map((e) => { const b = e.getBoundingClientRect(); return [s, Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100].join(' '); });
  return ['.ink-page-title .ink-title-editable', '.ink-db-tab', '.ink-db-new-main', '.ink-tv-hcell', '.ink-tv-row', '.ink-tv-cell.is-title', '.ink-tag', '.ink-status', '.ink-bv-col', '.ink-bv-card', '.ink-bv-pill', '.ink-gv-card', '.ink-lv-row', '.ink-cal-cell', '.ink-cal-wd > div', '.ink-cal-event', '.ink-tl-bar', '.ink-peek', '.ink-peek .ink-title-editable', '.ink-rowprop'].flatMap(q);
});
console.log(r.join('\n'));
if (process.env.OUT) await page.screenshot({ path: process.env.OUT });
await browser.close();
