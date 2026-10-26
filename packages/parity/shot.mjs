import { chromium } from 'playwright';
const [,, q, out, js] = process.argv;
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=light' + q);
await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(500);
if (js) { await page.evaluate(js); await page.waitForTimeout(600); }
await page.screenshot({ path: out });
await browser.close();
