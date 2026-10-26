// DB geometry vs ref/computed/db_<theme>.json → docs/parity/db-geometry-<theme>.md
import { chromium } from 'playwright';
import fs from 'node:fs';
const theme = process.argv[2] || 'light';
const ref = JSON.parse(fs.readFileSync(`/workspace/notion-research/ref/computed/db_${theme}.json`, 'utf8'));
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 1320, height: 824 } });
const url = (extra = '') => `http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=${theme}${extra}#/p/page-db`;
const load = async (extra) => { await p.goto(url(extra)); await p.reload(); await p.waitForFunction(() => window.__inkwellReady); await p.waitForTimeout(500); };
const rect = (sel, i = 0) => p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, [sel, i]);
const view = async (v) => { await p.evaluate((v) => window.__ink.setActiveView('page-db', v), v); await p.waitForTimeout(400); };
const rows = []; let pass = 0, tot = 0;
const f = (n) => (n == null ? '–' : Math.round(n * 100) / 100);
async function cmp(label, r, sel, i = 0, keys = ['x', 'y', 'w', 'h']) {
  const o = await rect(sel, i); tot++;
  if (!o || !r) { rows.push(`| ${label} | ${r ? keys.map((k) => k + '=' + f(r[k])).join(' ') : '–'} | ${o ? '' : 'missing'} | ❌ |`); return; }
  const d = keys.map((k) => o[k] - r[k]); const ok = d.every((x) => Math.abs(x) <= 1.01); if (ok) pass++;
  rows.push(`| ${label} | ${keys.map((k) => k + '=' + f(r[k])).join(' ')} | ${keys.map((k) => k + '=' + f(o[k])).join(' ')} | ${ok ? '✅' : '❌'} ${keys.map((k, j) => k + (d[j] >= 0 ? '+' : '') + f(d[j])).join(' ')} |`);
}
const R = (o) => o?.rect;
await load();
const T = ref.table;
await view('view-0');
await cmp('db title', R(T.dbTitle), '.ink-main .ink-page-title', 0, ['x', 'y', 'h']);
for (let i = 0; i < 2; i++) await cmp('view tab ' + i, R(T.viewTabs[i]), '.ink-main .ink-db-tab', i);
await cmp('new button', R(T.newBtn), '.ink-main .ink-db-new-main', 0, ['y', 'h']);
for (let i = 0; i < 4; i++) await cmp('header cell ' + i, R(T.headerCells[i]), '.ink-main .ink-tv-hcell', i);
for (let i = 0; i < 3; i++) await cmp('row ' + i, R(T.rows[i]), '.ink-main .ink-tv-row', i, ['x', 'y', 'h']);
await cmp('select tag', R(T.selectTag), '.ink-main .ink-tv-row:nth-of-type(1) [data-prop="category"] .ink-tag', 0, ['x', 'y', 'h']);
await p.hover('.ink-main .ink-tv-row >> nth=2'); await p.waitForTimeout(200);
await cmp('open button (hover)', R(ref.tableRowHover.openBtn), '.ink-main .ink-tv-row:nth-child(3) .ink-tv-open', 0, ['y', 'h']);
await view('view-1');
for (let i = 0; i < 4; i++) await cmp('board card ' + i, R(ref.board.cards[i]), '.ink-main .ink-bv-card', i);
for (let i = 0; i < 3; i++) await cmp('board group pill ' + i, R(ref.board.groupHeaders[i][2]), '.ink-main .ink-bv-pill', i, ['x', 'y', 'h']);
await view('view-3');
for (const [k, sz] of [['galleryM', 'M'], ['galleryS', 'S'], ['galleryL', 'L']]) {
  await p.evaluate((sz) => { const s = window.__ink.store; s.transact('g', (tx) => tx.update('page-db', (b) => ({ props: { ...b.props, views: b.props.views.map((v) => (v.id === 'view-3' ? { ...v, gallerySize: sz } : v)) } })), { noUndo: true }); }, sz);
  await p.waitForTimeout(300);
  for (let i = 0; i < 4; i++) await cmp(`gallery ${sz} card ${i}`, R(ref[k].cards[i]), '.ink-main .ink-gv-card', i);
}
await view('view-4');
const C = ref.calendar;
await cmp('calendar weekday 0', R(C.weekday[0]), '.ink-main .ink-cal-wd > div', 0);
for (let i = 0; i < 4; i++) await cmp('calendar cell ' + i, R(C.cells[i]), '.ink-main .ink-cal-cell', i);
await cmp('calendar today badge', R(C.today), '.ink-main .ink-cal-day.is-today', 0);
await cmp('calendar event (outer)', R(C.event[0][3]), '.ink-main .ink-cal-event', 0, ['y', 'h']);
await view('view-0');
await p.click('.ink-main .ink-db-tabs [aria-label], .ink-main .ink-db-tab:has-text("其他")').catch(() => {});
await p.waitForTimeout(300);
await cmp('views menu surface', R(ref.viewsMenu.surfaces[0]), '.ink-popover .ink-menu', 0, ['w']);
await p.keyboard.press('Escape');
await load('&sidebar=closed');
await p.evaluate(() => window.__ink.openPeek('row-03', 'side')); await p.waitForTimeout(500);
await cmp('side peek', R(ref.sidePeek.panel[0]), '.ink-peek-side');
await cmp('side peek title', R(ref.sidePeek.title), '.ink-peek .ink-page-title', 0, ['x', 'y', 'w']);
await p.evaluate(() => { window.__ink.closePeek(); window.__ink.openPeek('row-01', 'center'); }); await p.waitForTimeout(500);
await cmp('center peek', R(ref.centerPeek.surfaces[0]), '.ink-peek-center');
await cmp('center peek title', R(ref.centerPeek.title), '.ink-peek .ink-page-title', 0, ['x', 'y', 'w']);
await b.close();
const md = `# DB geometry vs computed (${theme})\n\n**${pass}/${tot}** within 1px\n\n| element | reference | ours | Δ |\n|---|---|---|---|\n${rows.join('\n')}\n`;
fs.writeFileSync(`/workspace/inkwell/docs/parity/db-geometry-${theme}.md`, md); console.log(md);
