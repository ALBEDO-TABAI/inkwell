// M7 behaviour harness: quick-search window mode, templates, settings panes (persisted), import/export, zh-TW, high contrast, sidebar prefs, badge.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1320, height: 824 } });
const STUB = (() => { window.__sent = []; window.inkwellNative = { platform: 'darwin', send: (t, p) => window.__sent.push([t, p]), on: () => () => {}, invoke: async (c) => (c === 'inkwell:check-updates' ? { current: '0.4.0' } : null) }; }).toString();
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const base = 'http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=light';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
const load = async (q = '', h = '#/p/page-rea') => { await page.goto(base + q + h); await page.waitForFunction(() => window.__inkwellReady); await page.evaluate(`(${STUB})()`); await page.waitForTimeout(400); };

// quick-search window
await load('&quick=1', '');
ok(await page.locator('.ink-quick-root .ink-search').count() === 1, 'quick mode renders the palette alone');
ok(await page.locator('.ink-topbar').count() === 0, 'no app chrome in the quick window');
ok(await page.evaluate(() => document.activeElement?.tagName === 'INPUT'), 'query input focused');
await page.keyboard.type('REA DB'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
let sent = await page.evaluate(() => window.__sent);
ok(sent.some(([t, p]) => t === 'inkwell:quick-open' && p.pageId && !p.newTab), 'Enter → quick-open {pageId}');
await page.keyboard.type('Task'); await page.waitForTimeout(250); await page.keyboard.press('Meta+Enter'); await page.waitForTimeout(200);
sent = await page.evaluate(() => window.__sent);
ok(sent.some(([t, p]) => t === 'inkwell:quick-open' && p.newTab), '⌘↵ → quick-open in a new tab');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
ok((await page.evaluate(() => window.__sent)).some(([t]) => t === 'inkwell:quick-close'), 'Esc → quick-close');

// templates
await load();
await page.evaluate(() => import('/src/shell/Templates.tsx').then((m) => m.openTemplates())); await page.waitForTimeout(300);
ok(await page.locator('.ink-tpl-card').count() >= 12, 'gallery lists templates');
await page.click('[data-cat="school"]'); await page.waitForTimeout(150);
ok(await page.locator('.ink-tpl-card').count() === 2, 'category filter');
await page.fill('.ink-tpl-search input', '会议'); await page.waitForTimeout(150);
ok(await page.locator('.ink-tpl-card').count() === 0, 'search within category (none)');
await page.click('[data-cat="all"]'); await page.waitForTimeout(150);
ok(await page.locator('.ink-tpl-card').count() === 1, 'search across all → 会议记录');
await page.click('.ink-tpl-card'); await page.waitForTimeout(150);
ok(await page.locator('.ink-tpl-preview h1').innerText() === '会议记录', 'detail preview');
await page.click('[data-testid="tpl-use"]'); await page.waitForTimeout(400);
const made = await page.evaluate(() => { const s = window.__ink.store; const id = window.__ink.getUi().pageId; const b = s.blocks.get(id); return { title: b.title?.[0]?.[0], icon: b.format?.page_icon, kids: (b.content || []).map((c) => s.blocks.get(c).type) }; });
ok(made.title === '会议记录' && made.icon === '📝' && made.kids.includes('to_do') && made.kids.includes('numbered_list'), 'use template creates page: ' + JSON.stringify(made).slice(0, 120));

// settings panes
await page.evaluate(() => import('/src/shell/Settings.tsx').then((m) => m.openSettings('notifications'))); await page.waitForTimeout(300);
ok(await page.locator('[data-kv="pushReminders"] .ink-switch.is-on').count() === 1, 'notifications: reminder push on by default');
await page.click('[data-kv="badgeEnabled"] .ink-switch'); await page.waitForTimeout(200);
ok((await page.evaluate(() => window.__sent)).some(([t, p]) => t === 'inkwell:badge' && p.count === 0), 'badge off → badge 0 sent');
for (const pane of ['通用', '人员', '侧边栏', '导入', '表情符号', '离线', '开发者', '邮箱和日历']) {
  await page.click(`.ink-set-nav-item:has-text("${pane}")`); await page.waitForTimeout(120);
  ok((await page.locator('.ink-set-h1').innerText()).trim() === pane, 'pane ' + pane);
}
await page.click('.ink-set-nav-item:has-text("通用")'); await page.waitForTimeout(100);
await page.click('button:has-text("检查更新")'); await page.waitForTimeout(700);
ok(await page.locator('text=已是最新版本（0.4.0）').count() === 1, 'update-check stub reports up to date');
await page.click('.ink-set-nav-item:has-text("侧边栏")'); await page.waitForTimeout(100);
await page.click('[data-kv="sbShowAgenda"] .ink-switch'); await page.waitForTimeout(200);
ok(await page.locator('.ink-sidebar:has-text("即将开始的活动")').count() === 0, 'sidebar pref hides 即将开始的活动');
await page.click('[data-kv="sbShowAgenda"] .ink-switch'); await page.waitForTimeout(200);
await page.click('.ink-set-nav-item:has-text("偏好")'); await page.waitForTimeout(100);
await page.click('.ink-set-row:has-text("语言") .ink-select, .ink-set-row:has-text("语言") [role="button"]'); await page.waitForTimeout(200);
const tw = page.locator('.ink-menu-item:has-text("繁體中文")');
ok(await tw.count() === 1, 'language select lists 繁體中文');
await tw.click(); await page.waitForTimeout(300);
ok(await page.locator('.ink-set-h1').innerText() === '偏好設定' || /[設頁]/.test(await page.locator('.ink-settings').innerText()), 'zh-TW applied: ' + (await page.locator('.ink-set-h1').innerText()));
await page.evaluate(() => import('/src/i18n/index.ts').then((m) => m.setLocale('zh-CN')));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// high contrast shortcut persists
await load();
await page.keyboard.press('Meta+Shift+Alt+KeyL'); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.documentElement.getAttribute('data-contrast') === 'high' || !!document.querySelector('[data-contrast="high"]')), 'high contrast on');
await page.keyboard.press('Meta+Shift+Alt+KeyL'); await page.waitForTimeout(200);

// export / import markdown round trip
const md = await page.evaluate(() => import('/src/editor/clipboard.ts').then((m) => m.pageToMarkdown('page-rea')));
ok(md.includes('# REA') || md.length > 200, 'export markdown (' + md.length + ' chars)');
const ids = await page.evaluate(async () => { const io = await import('/src/app/io.ts'); return io.importFiles([new File(['# 导入测试\n\n## 小节\n- [ ] 任务\n- 要点\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n'], 'x.md')]); });
const imp = await page.evaluate((id) => { const s = window.__ink.store; const b = s.blocks.get(id); return { t: b?.title?.[0]?.[0], k: (b?.content || []).map((c) => s.blocks.get(c).type) }; }, ids[0]);
ok(imp.t === '导入测试' && imp.k.join() === 'sub_header,to_do,bulleted_list,table', 'import markdown: ' + JSON.stringify(imp));
const html = await page.evaluate(() => import('/src/app/io.ts').then((m) => m.pageToHtml('page-rea')));
ok(html.startsWith('<!doctype html>') && html.includes('<h1'), 'export html');

console.log('m7:', pass + '/' + (pass + fail), errs.length ? 'errors: ' + errs.join(' | ') : '');
await browser.close();
