import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 1320, height: 824 } });
await p.goto('http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=light#/p/page-rea'); await p.waitForFunction(() => window.__inkwellReady); await p.waitForTimeout(500);
await p.click('.ink-more-btn').catch(e=>console.log(e.message)); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/o_pm.png' });
await p.keyboard.press('Escape'); await p.evaluate(() => import('/src/shell/Trash.tsx').then(m => m.openTrash())); await p.waitForTimeout(200); await p.keyboard.type('REA'); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/o_tr.png' });
await b.close();
