// Geometry parity: compares our element rects with the reference computed-style captures.
import { chromium } from 'playwright';
import fs from 'node:fs';
const REF = '/workspace/notion-research/ref/computed';
const theme = process.argv[2] || 'light';
const shell = JSON.parse(fs.readFileSync(`${REF}/shell_${theme}.json`));
const blocks = JSON.parse(fs.readFileSync(`${REF}/blocks_${theme}.json`));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&theme=${theme}#/p/page-rea`);
await page.waitForFunction(() => window.__inkwellReady);
await page.waitForTimeout(400);
const r = (o) => o && { x: o.x, y: o.y, w: o.w, h: o.h };
const rows = [];
const cmp = (name, ref, ours, rel = false) => {
  if (!ref || !ours) { rows.push([name, ref ? fmt(ref) : '—', ours ? fmt(ours) : 'missing', '']); return; }
  const keys = rel ? ['w', 'h', 'dx', 'dy'] : ['x', 'y', 'w', 'h'];
  const d = keys.map((k) => +(ours[k] - ref[k]).toFixed(2));
  const worst = Math.max(...d.map(Math.abs));
  rows.push([name, fmt(ref, keys), fmt(ours, keys), (worst <= 1 ? '✅ ' : '❌ ') + keys.map((k, i) => `${k}${d[i] >= 0 ? '+' : ''}${d[i]}`).join(' ')]);
};
const fmt = (o, keys = ['x', 'y', 'w', 'h']) => keys.map((k) => `${k}=${+(+o[k]).toFixed(2)}`).join(' ');
const q = (sel, i = 0) => page.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, [sel, i]);
// shell
cmp('sidebar', r(shell.sidebarContainer.rect), await q('.ink-sidebar'));
cmp('sidebar search', r(shell.sidebarSearch.rect), await q('.ink-sb-search'));
for (let i = 0; i < 3; i++) cmp(`section header ${i}`, r(shell.sectionHeaders[i][1].rect), await q('.ink-sb-section-head', i));
const treeRows = await page.evaluate(() => [...document.querySelectorAll('.ink-sb-section')].pop().querySelectorAll('.ink-sb-row').length);
for (let i = 0; i < Math.min(7, shell.rows.length); i++) cmp(`private row ${i}`, r(shell.rows[i].rect), await page.evaluate((i) => { const el = [...document.querySelectorAll('.ink-sb-section')].pop().querySelectorAll('.ink-sb-row')[i]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, i));
cmp('workspace switcher', r(shell.workspaceSwitcher[0].rect), await q('.ink-sb-switcher'));
cmp('topbar', r(shell.topbar[1].rect), await q('.ink-topbar'));
cmp('breadcrumb 0', r(shell.breadcrumbs[0].rect), await q('.ink-crumb'));
cmp('share button', r(shell.shareBtn.rect), await q('.ink-share-btn'));
cmp('page ··· button', r(shell.moreBtn.rect), await q('.ink-more-btn'));
cmp('page title', r(shell.title[0].rect), await q('.ink-page-title'));
cmp('page content', { ...r(shell.pageContent.rect), h: 0 }, { ...(await q('.ink-page-content')), h: 0 });
// blocks: size + inner offset
const MAP = {
  text: ['[data-editable-id]'], header: ['[data-editable-id]'], sub_header: ['[data-editable-id]'], sub_sub_header: ['[data-editable-id]'],
  bulleted_list: ['.ink-marker'], numbered_list: ['.ink-marker'], to_do: ['.ink-marker'], toggle: ['.ink-marker'],
  quote: ['.ink-quote > .ink-editable'], callout: ['.ink-callout-icon-btn', 'callout'], code: ['.ink-code'], divider: ['.ink-divider div', 'decorated'],
  table: ['th', 'decorated'], image: ['.ink-image-frame'], bookmark: ['.ink-bookmark'], equation: ['.ink-equation'], column_list: ['[data-editable-id]'],
  table_of_contents: ['.ink-toc'], page: ['.ink-pagelink'], alias: ['.ink-pagelink'], transclusion_container: ['[data-editable-id]', 'synced'],
  collection_view_page: ['.ink-pagelink'], video: ['.ink-video-frame'], breadcrumb: ['.ink-crumbs-block'],
};
for (const [type, [inner, mode]] of Object.entries(MAP)) {
  const ref = blocks[type]; if (!ref || ref.missing) continue;
  const ourType = type === 'transclusion_container' ? 'synced' : type;
  const res = await page.evaluate(([t, s]) => {
    const pick = [...document.querySelectorAll(`.ink-page [data-type="${t}"]`)].find((b) => t !== 'text' || (b.parentElement?.classList.contains('ink-page-blocks') && b.textContent.length > 100)) || document.querySelector(`.ink-page [data-type="${t}"]`);
    if (!pick) return null;
    const b = pick.getBoundingClientRect(); const e = pick.querySelector(s)?.getBoundingClientRect();
    return { block: { w: b.width, h: b.height, dx: 0, dy: 0 }, inner: e ? { w: e.width, h: e.height, dx: e.x - b.x, dy: e.y - b.y } : null };
  }, [ourType, inner]);
  const rb = ref.block.rect; const re = (mode === 'decorated' ? ref.decorated?.[0] : ref.editable)?.rect || ref.decorated?.[0]?.rect;
  cmp(`${type} block`, { w: rb.w, h: rb.h, dx: 0, dy: 0 }, res?.block, true);
  if (re) cmp(`${type} inner`, { w: re.w, h: re.h, dx: re.x - rb.x, dy: re.y - rb.y }, res?.inner, true);
}
const ok = rows.filter((x) => x[3].startsWith('✅')).length;
const md = `### Geometry (${theme}) — ${ok}/${rows.length} within 1px\n\n| element | reference | ours | delta |\n|---|---|---|---|\n` + rows.map((x) => `| ${x.join(' | ')} |`).join('\n') + '\n';
fs.mkdirSync('/workspace/inkwell/docs/parity', { recursive: true });
fs.writeFileSync(`/workspace/inkwell/docs/parity/geometry-${theme}.md`, md);
console.log(md);
await browser.close();
