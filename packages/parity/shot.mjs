// usage: node shot.mjs <url-path> <out.png> [w h dpr] [--js "code"]
import { chromium } from 'playwright';
const [, , path, out, w = '1320', h = '824', dpr = '2'] = process.argv;
const jsIdx = process.argv.indexOf('--js');
const js = jsIdx > 0 ? process.argv[jsIdx + 1] : null;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:5200/' + path);
await page.waitForFunction(() => window.__inkwellReady || document.querySelector('.ink-window'), null, { timeout: 10000 }).catch(() => errs.push('not ready'));
await page.waitForTimeout(500);
if (js) { await page.evaluate(js); await page.waitForTimeout(400); }
await page.screenshot({ path: out });
console.log(errs.join('\n') || 'ok');
await browser.close();
