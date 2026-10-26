// B08 parity: REA reference page in 700px scroll steps, both themes, 2x.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/B08';
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(DOC, { recursive: true });
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const results = [];
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1${theme === "light" ? "&idle=1" : ""}&theme=${theme}#/p/page-rea`);
  await page.waitForFunction(() => window.__inkwellReady);
  await page.waitForTimeout(600);
  for (let i = 1; i <= 7; i++) {
    const name = `p${i}_${theme}`;
    if (only && !name.includes(only)) continue;
    await page.evaluate((y) => { document.querySelector('.ink-scroller').scrollTop = y; }, (i - 1) * 700);
    await page.waitForTimeout(250);
    const ours = `${OUT}B08_${name}.png`;
    await page.screenshot({ path: ours });
    const ref = `${REF}/B08_fixture_${name}.png`;
    const res = {};
    for (const [region, box] of Object.entries({ sidebar: [0, 0, 270, 824], page: [270, 44, 1304, 824] })) {
      const out = execFileSync('python3', ['compare.py', ref, ours, `${OUT}cmp_${name}_${region}.png`, ...box.map(String)], { cwd: new URL('.', import.meta.url).pathname }).toString();
      res[region] = out.match(/mismatch ([\d.]+)%/)[1];
    }
    execFileSync('python3', ['compare.py', ref, ours, `${DOC}/B08_${name}.png`, '--1x'], { cwd: new URL('.', import.meta.url).pathname });
    results.push({ name, ...res });
    console.log(name, res);
  }
  await page.close();
}
fs.writeFileSync(`${OUT}b08.json`, JSON.stringify(results, null, 2));
await browser.close();
