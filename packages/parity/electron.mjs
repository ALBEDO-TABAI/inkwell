// Electron shell harness: real Electron under Xvfb, driven over CDP.
// Checks window + tab views, tab creation via the tab bar "+", SQLite persistence, state restore, deep links;
// writes docs/parity/E01_*.png (tab bar vs B02 ref) and out/electron.json.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { targets, connect, sleep } from './cdp-lite.mjs';
const DESK = new URL('../desktop/', import.meta.url).pathname;
const OUT = new URL('./out/', import.meta.url).pathname;
const DOC = '/workspace/inkwell/docs/parity';
const UD = '/tmp/inkwell-e2e';
const cwd = new URL('.', import.meta.url).pathname;
const res = [];
const ok = (name, pass, info = '') => { res.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };
let proc;
function launch(extra = [], port = 9333, env = {}) {
  const p = spawn('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', 'npx', 'electron', '.', '--no-sandbox', `--remote-debugging-port=${port}`, ...extra],
    { cwd: DESK, env: { ...process.env, INKWELL_USER_DATA: UD, INKWELL_LOCALE: 'zh-CN', ...env }, detached: true });
  p.log = ''; p.stdout.on('data', (d) => (p.log += d)); p.stderr.on('data', (d) => (p.log += d));
  return p;
}
async function waitApps(n, port = 9333, ms = 20000) {
  const t0 = Date.now();
  for (;;) {
    try { const ts = await targets(port); const apps = ts.filter((t) => t.url.includes('index.html')); const tb = ts.find((t) => t.url.includes('tabbar')); if (apps.length >= n && tb) return { apps, tb }; } catch {}
    if (Date.now() - t0 > ms) throw new Error('timeout waiting for ' + n + ' app views');
    await sleep(300);
  }
}
const ready = async (c) => { for (let i = 0; i < 60; i++) { if (await c.evaluate('!!window.__inkwellReady').catch(() => false)) return; await sleep(250); } };
async function stop(p) { try { process.kill(-p.pid, 'SIGTERM'); } catch {} for (let i = 0; i < 40 && fs.existsSync(`/proc/${p.pid}`); i++) await sleep(250); try { execFileSync('pkill', ['-f', `remote-debugging-port=9333`]); } catch {} await sleep(500); }
async function stack(tbC, appC, file) {
  await tbC.shot('/tmp/e_tb.png'); await appC.shot('/tmp/e_app.png');
  execFileSync('python3', ['-c', `from PIL import Image
a=Image.open('/tmp/e_tb.png').convert('RGB'); b=Image.open('/tmp/e_app.png').convert('RGB')
im=Image.new('RGB',(1320,860)); im.paste(a,(0,0)); im.paste(b,(0,36)); im.save('${file}')`]);
}
const visible = async (c) => c.evaluate('document.visibilityState');

fs.rmSync(UD, { recursive: true, force: true });
try { execFileSync('pkill', ['-f', 'remote-debugging-port=9333']); } catch {}
// ---- run 1: fresh profile
proc = launch([], 9333, { INKWELL_QUICK_KEEP: '1' });
let { apps, tb } = await waitApps(1);
await sleep(1500);
ok('storage backend is sqlite', /storage: sqlite/.test(proc.log), (proc.log.match(/storage: \S+/) || [''])[0]);
let tbC = await connect(tb.webSocketDebuggerUrl), appC = await connect(apps[0].webSocketDebuggerUrl);
await ready(appC);
ok('tab view 1320x824 under 36px tab bar', JSON.stringify(await appC.evaluate('[innerWidth,innerHeight]')) === '[1320,824]' && JSON.stringify(await tbC.evaluate('[innerWidth,innerHeight]')) === '[1320,36]');
ok('preloads exposed', (await appC.evaluate('!!window.inkwellNative && window.inkwellNative.platform')) && (await tbC.evaluate('!!window.inkwellTabs')));
for (const theme of ['light']) {
  await stack(tbC, appC, `${OUT}E01_window_${theme}.png`);
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${OUT}E01_window_${theme}.png').crop((0,0,1320,36)).save('${OUT}E01_tb_${theme}.png'); Image.open('/workspace/notion-research/ref/B02/B02_tabs_1_${theme}.png').convert('RGB').crop((0,0,1320,36)).save('${OUT}ref_E01_tb_${theme}.png')`]);
  const m = execFileSync('python3', ['compare.py', `${OUT}ref_E01_tb_${theme}.png`, `${OUT}E01_tb_${theme}.png`, `${DOC}/E01_tabbar_1_${theme}.png`], { cwd }).toString().trim();
  ok(`tab bar pixel diff vs B02_tabs_1 (${theme})`, true, m);
  fs.copyFileSync(`${OUT}E01_window_${theme}.png`, `${DOC}/E01_window_${theme}.png`);
}
// create a page in tab 1 (Ctrl+N), type a title
const key = async (c, k, code, mods) => { for (const type of ['rawKeyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: k, code, modifiers: mods, windowsVirtualKeyCode: k === 'Escape' ? 27 : k.toUpperCase().charCodeAt(0) }); };
await key(appC, 'n', 'KeyN', 2);
await sleep(800);
console.log('  focus after Ctrl+N:', await appC.evaluate('document.activeElement?.className + " hasFocus=" + document.hasFocus()'));
await appC.evaluate('document.querySelector(".ink-title-editable")?.focus()');
await appC.send('Input.insertText', { text: 'Electron 持久化测试' });
await sleep(1200);
const title1 = await appC.evaluate('document.querySelector(".ink-title-editable")?.innerText || ""');
ok('Ctrl+N creates a page and title typed', /Electron 持久化测试/.test(title1), JSON.stringify(title1));
// click "+" in the tab bar -> second tab view
const plus = await tbC.evaluate(`(()=>{const b=document.querySelector('.ink-tbar-new');const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
for (const type of ['mousePressed', 'mouseReleased']) await tbC.send('Input.dispatchMouseEvent', { type, x: plus[0], y: plus[1], button: 'left', clickCount: 1 });
({ apps } = await waitApps(2));
await sleep(1500);
const tabTitles = await tbC.evaluate(`[...document.querySelectorAll('.ink-tab')].map(t=>t.innerText.trim())`);
ok('tab bar "+" opens a second tab view', apps.length === 2 && tabTitles.length === 2, JSON.stringify(tabTitles));
const tabId = (u) => new URL(u).searchParams.get('tab');
apps.sort((a, b) => tabId(a.url) < tabId(b.url) ? -1 : 1);
const vis = await Promise.all(apps.map(async (a) => { const c = await connect(a.webSocketDebuggerUrl); const v = await visible(c); c.close(); return v; }));
ok('only the active tab view is visible', vis.filter((v) => v === 'visible').length === 1, JSON.stringify(vis));
ok('first tab title follows the page', tabTitles.some((t) => /Electron 持久化测试/.test(t)));
// switch back with Ctrl+1 (before-input-event) from the visible tab
const visT = apps[vis.indexOf('visible')]; const vc = await connect(visT.webSocketDebuggerUrl);
await ready(vc); await sleep(600);
const pal = await vc.evaluate(`({ph: document.querySelector('.ink-search input')?.placeholder, rows: [...document.querySelectorAll('.ink-search-row .ink-search-title')].slice(0,3).map(e=>e.innerText)})`);
ok('new tab opens the "open in new tab…" palette', pal.ph === '在新选项卡中打开…' && pal.rows[0] === '新对话' && pal.rows[1] === '新页面', JSON.stringify(pal));
await stack(tbC, vc, `${OUT}E02_newtab_light.png`);
const mN = execFileSync('python3', ['compare.py', '/workspace/notion-research/ref/B02/B02_newtab_empty_light.png', `${OUT}E02_newtab_light.png`, `${DOC}/E02_newtab_light.png`, '0', '0', '1320', '860', '--1x'], { cwd }).toString().trim();
ok('new-tab window pixel diff vs B02_newtab_empty (light)', true, mN);
await key(vc, 'Escape', 'Escape', 0); await sleep(300);
await key(vc, '1', 'Digit1', 2); await sleep(800);
const vis2 = await Promise.all(apps.map(async (a) => { const c = await connect(a.webSocketDebuggerUrl); const v = await visible(c); c.close(); return v; }));
ok('Ctrl+1 activates first tab', vis2[0] === 'visible' && vis2[1] === 'hidden', JSON.stringify(vis2));
// live cross-tab sync: edit the title in tab 1, tab 2 (hidden renderer) must update
await appC.evaluate(`(()=>{const el=document.querySelector('.ink-title-editable');el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)})()`);
await appC.send('Input.insertText', { text: ' 同步' }); await sleep(1200);
const c2 = await connect(apps[1].webSocketDebuggerUrl);
ok('edit in tab 1 shows up live in tab 2', /Electron 持久化测试 同步/.test(await c2.evaluate('document.body.innerText')));
c2.close();
// bookmark OG metadata is fetched by the main process (local server stands in for a website)
{
  const http = await import('node:http');
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end('<html><head><title>T</title><meta property="og:title" content="本地书签测试"><meta property="og:description" content="描述文字"><meta property="og:image" content="/i.png"></head></html>'); });
  await new Promise((r) => srv.listen(18777, '127.0.0.1', r));
  const og = await appC.evaluate(`window.inkwellNative.invoke('inkwell:fetch-og','http://127.0.0.1:18777/p')`).catch((e) => ({ err: String(e) }));
  ok('bookmark OG fetched in main process', og && og.title === '本地书签测试' && /描述/.test(og.description || ''), JSON.stringify(og));
  srv.close();
}
// quick-search window: frameless 755×700, ⇧⌘K / tray / IPC toggle; picking a result navigates the main window
const origHash = await appC.evaluate('location.hash');
await appC.evaluate(`window.inkwellNative.send('inkwell:quick-toggle')`);
let qt; for (let i = 0; i < 40 && !qt; i++) { await sleep(250); qt = (await targets(9333)).find((t) => t.url.includes('quick=1')); }
ok('quick-search window opens', !!qt, qt?.url.replace(/^.*\?/, '?'));
if (qt) {
  const qc = await connect(qt.webSocketDebuggerUrl); await ready(qc);
  const dims = await qc.evaluate('[innerWidth, innerHeight, !!document.querySelector(".ink-quick-root .ink-search"), !document.querySelector(".ink-topbar")]');
  ok('quick window is 755×700 with only the palette', JSON.stringify(dims) === '[755,700,true,true]', JSON.stringify(dims));
  await qc.evaluate(`window.inkwellNative.send('inkwell:quick-open', { pageId: 'page-rea', newTab: false })`); await sleep(1200);
  const tsNow = await targets(9333); const act = [];
  for (const t of tsNow.filter((t) => t.url.includes('index.html') && !t.url.includes('quick=1'))) { const c = await connect(t.webSocketDebuggerUrl); act.push([await c.evaluate('document.visibilityState'), await c.evaluate('location.hash')]); c.close(); }
  ok('quick-open navigates the active tab', act.some(([v, h]) => v === 'visible' && h === '#/p/page-rea'), JSON.stringify(act));
  qc.close();
  await appC.evaluate(`location.hash = ${JSON.stringify(origHash)}`); await sleep(800);
}
// ---- quit (SIGTERM -> app.quit -> before-quit persists)
tbC.close(); appC.close(); vc.close();
await stop(proc);
const st = JSON.parse(fs.readFileSync(`${UD}/window-state.json`, 'utf8'));
ok('window-state.json written with 2 tabs', st.windows?.[0]?.tabs?.length === 2, JSON.stringify(st.windows?.[0]?.tabs?.map((t) => [t.hash, t.active, t.title])));
const dbf = 'inkwell.db';
const dbBytes = ['', '-wal'].reduce((n, x) => n + (fs.existsSync(`${UD}/${dbf}${x}`) ? fs.statSync(`${UD}/${dbf}${x}`).size : 0), 0);
ok('SQLite file on disk', dbBytes > 4096, `${dbf} (+wal) ${dbBytes} bytes`);
// ---- run 2: restore
proc = launch();
({ apps, tb } = await waitApps(2));
await sleep(2000);
tbC = await connect(tb.webSocketDebuggerUrl);
const tabTitles2 = await tbC.evaluate(`[...document.querySelectorAll('.ink-tab')].map(t=>t.innerText.trim())`);
ok('restart restores both tabs', tabTitles2.length === 2, JSON.stringify(tabTitles2));
const act = []; for (const a of apps) { const c = await connect(a.webSocketDebuggerUrl); await ready(c); act.push({ v: await visible(c), hash: await c.evaluate('location.hash'), txt: await c.evaluate('document.body.innerText') }); c.close(); }
const active = act.find((a) => a.v === 'visible');
ok('restored active tab is the first tab (Ctrl+1 state)', active && /Electron 持久化测试/.test(active.txt.split('\n').slice(-80).join('\n')) && st.windows[0].tabs[0].active, active?.hash);
ok('page created before restart persisted in SQLite (sidebar)', act.every((a) => /Electron 持久化测试/.test(a.txt)));
// ---- deep link via second instance
const pid = (active?.hash.match(/#\/p\/([^?]+)/) || [])[1];
const p2 = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--no-sandbox', 'inkwell://page/page-rea'], { cwd: DESK, env: { ...process.env, INKWELL_USER_DATA: UD } });
await new Promise((r) => { p2.on('exit', r); setTimeout(r, 15000); });
await sleep(1500);
const after = []; for (const a of (await waitApps(2)).apps) { const c = await connect(a.webSocketDebuggerUrl); after.push({ v: await visible(c), hash: await c.evaluate('location.hash') }); c.close(); }
const act3 = after.find((a) => a.v === 'visible');
ok('inkwell://page/<id> deep link (second instance) navigates active tab', /page-rea/.test(act3?.hash || ''), `${pid} -> ${act3?.hash}`);
tbC.close();
await stop(proc);
// ---- native menu vs B02b (accessibility dump of the reference; system-injected macOS items ignored)
const DUMP = `${OUT}menu-dump.json`; fs.rmSync(DUMP, { force: true });
proc = launch([], 9333, { INKWELL_MENU_DUMP: DUMP, INKWELL_MENU_PLATFORM: 'darwin' });
for (let i = 0; i < 60 && !fs.existsSync(DUMP); i++) await sleep(250);
await stop(proc);
const ours = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
const SYS = /[選單語動撥聽寫符號啟傳給沒服務設結並保留視窗將縮滿移與調整螢幕側於從組合聯碼頂個]|等分|^[左右][上下]角$|^底部$|^排列$|^信用卡|^Zoom$|^Bring All|^中央$|^REA /;
const refMenus = { notion: 0, file: 1, edit: 2, view: 3, history: 4, window: 5, help: 6 };
const brand = ours[0].label;
let tot = 0, hit = 0; const missing = [];
for (const [name, idx] of Object.entries(refMenus)) {
  const txt = fs.readFileSync(`/workspace/notion-research/ref/B02b/B02b_menu_${name}.txt`, 'utf8').split('\n');
  const flat = (ns) => ns.flatMap((n) => [n.label, ...(n.submenu ? flat(n.submenu) : [])]);
  const have = new Set(flat(ours[idx]?.submenu || []).map((l) => l.replace(/\.\.\.$/, '…')));
  for (const line of txt) {
    const m = line.match(/^\t+\d+ (?:\(disabled\) )?(.+?)(?:, (?:ID|Secondary).*)?$/); if (!m) continue;
    const label = m[1].replaceAll('Notion', brand);
    if (SYS.test(label)) continue;
    tot++; if (have.has(label)) hit++; else missing.push(`${name}: ${label}`);
  }
}
ok('native menu items match B02b (app-defined items)', hit === tot, `${hit}/${tot}` + (missing.length ? ' missing: ' + missing.join(' | ') : ''));
ok('menu bar order matches B02b', JSON.stringify(ours.map((m) => m.label)) === JSON.stringify([brand, '文件', '编辑', '视图', '历史', '窗口', '帮助']), JSON.stringify(ours.map((m) => m.label)));
fs.writeFileSync(`${OUT}electron.json`, JSON.stringify(res, null, 2));
console.log(`electron: ${res.filter((r) => r.pass).length}/${res.length}`);
process.exit(0);
