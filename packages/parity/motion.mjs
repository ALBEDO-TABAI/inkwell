// Motion parity: trigger each animated interaction, read the live Web Animations (duration / easing / property),
// compare to the SPEC timings, and record frame strips by pausing the animations at fixed times.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const OUT = new URL('./out/motion/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 824 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const base = 'http://127.0.0.1:5200/index.html?fixture=1&storage=memory&harness=1&expand=page-rea&theme=light';
const load = async (h = '#/p/page-rea') => { await page.goto(base + h); await page.waitForFunction(() => window.__inkwellReady); await page.waitForTimeout(400); };
let pass = 0, fail = 0; const rows = [];
const norm = (e) => e.replace(/\s+/g, '').replace(/0\./g, '.');
function check(name, got, want) {
  const ok = got && Math.abs(got.duration - want.duration) <= 1 && (!want.easing || norm(got.easing) === norm(want.easing));
  ok ? pass++ : fail++;
  rows.push(`| ${name} | ${want.duration}ms ${want.easing || ''} | ${got ? `${got.duration}ms ${got.easing} (${got.prop})` : '—'} | ${ok ? '✅' : '❌'} |`);
  console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(got));
}
// collect running animations on `sel` right after `trigger`, pause them (so frames are exact)
async function grab(trigger, sel, { prop } = {}) {
  return page.evaluate(async ([trigger, sel, prop]) => {
    await (0, eval)(`(async () => { ${trigger} })()`);
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const el = document.querySelector(sel); if (!el) return null;
    const anims = el.getAnimations({ subtree: false }).filter((a) => !prop || (a.transitionProperty || a.animationName || '').includes(prop));
    document.getAnimations().forEach((a) => a.pause());
    const a = anims[0]; if (!a) return null;
    const tm = a.effect.getTiming();
    const kf = a.effect.getKeyframes?.()[0] || {};
    return { duration: Math.round(tm.duration), easing: a.transitionProperty ? tm.easing : (getComputedStyle(el).animationTimingFunction || tm.easing), prop: a.transitionProperty || a.animationName };
  }, [trigger, sel, prop || '']);
}
async function strip(name, sel, times, clip) {
  const files = [];
  for (const t of times) {
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), t);
    await page.waitForTimeout(30);
    const f = `${OUT}${name}-${t}.png`; await page.screenshot({ path: f, clip }); files.push(f);
  }
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size; s=min(1,320/w)
tw,th=int(w*s),int(h*s); out=Image.new('RGB',(tw*len(ims)+8*(len(ims)-1),th+22),'white'); d=ImageDraw.Draw(out)
for i,(im,f) in enumerate(zip(ims,fs)):
  out.paste(im.resize((tw,th)),(i*(tw+8),22)); d.text((i*(tw+8)+4,4),f.rsplit('-',1)[1][:-4]+' ms',fill='black')
out.save(sys.argv[1])`, `${OUT}${name}-strip.png`, ...files]);
}

// 1 sidebar collapse: width 200ms ease-out
await load();
check('sidebar collapse (width)', await grab(`window.__ink.setUi({ sidebarOpen: !window.__ink.getUi().sidebarOpen, peek: false })`, '.ink-sb-shell'), { duration: 200, easing: 'ease-out' });
await strip('sidebar-collapse', '.ink-sb-shell', [0, 50, 100, 150, 200], { x: 0, y: 0, width: 660, height: 420 });
await page.waitForTimeout(400);
check('sidebar expand (width)', await grab(`window.__ink.setUi({ sidebarOpen: !window.__ink.getUi().sidebarOpen, peek: false })`, '.ink-sb-shell'), { duration: 200, easing: 'ease-out' });
await page.waitForTimeout(400);

// 2 center peek: .2s ease-in-out (panel) + scrim fade
check('center peek panel', await grab(`window.__ink.openPeek('page-rea','center')`, '.ink-peek-center'), { duration: 200, easing: 'ease-in-out' });
await strip('center-peek', '.ink-peek-center', [0, 50, 100, 150, 200], { x: 0, y: 0, width: 1320, height: 824 });
await page.evaluate(() => window.__ink.closePeek()); await page.waitForTimeout(300);
check('center peek scrim', await grab(`window.__ink.openPeek('page-rea','center')`, '.ink-peek-scrim'), { duration: 200, easing: 'ease-in-out' });
await page.evaluate(() => { document.getAnimations().forEach((a) => a.finish()); window.__ink.closePeek(); }); await page.waitForTimeout(300);

// 3 side peek: 200ms ease-out
check('side peek slide', await grab(`window.__ink.openPeek('page-rea','side')`, '.ink-peek-side'), { duration: 200, easing: 'ease-out' });
await page.evaluate(() => window.__ink.closePeek()); await page.waitForTimeout(300);

// 4 menu fade: opacity 100ms ease
check('menu open (opacity)', await grab(`(await import('/src/ui/menu.tsx')).openMenu({left:400,top:100,right:420,bottom:120},{width:240,groups:[[{id:'a',label:'一项'},{id:'b',label:'二项'}]]})`, '.ink-popover'), { duration: 100, easing: 'ease' });
await strip('menu-open', '.ink-popover', [0, 25, 50, 75, 100], { x: 380, y: 90, width: 300, height: 120 });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// 5 settings modal: opacity 150ms ease
check('modal open (opacity)', await grab(`(await import('/src/shell/Settings.tsx')).openSettings('notifications')`, '.ink-popover.ink-settings-pop'), { duration: 150, easing: 'ease' });
await page.evaluate(() => document.getAnimations().forEach((a) => a.finish())); await page.waitForTimeout(200);

// 6 spring switch knob: 250ms cubic-bezier(.34,1.56,.64,1)
check('switch knob (spring)', await grab(`document.querySelector('[data-kv="pushComments"] .ink-switch').click()`, '[data-kv="pushComments"] .ink-switch-knob'), { duration: 250, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
const sw = await page.evaluate(() => { const r = document.querySelector('[data-kv="pushComments"]').getBoundingClientRect(); return { x: Math.round(r.x) - 6, y: Math.round(r.y) - 6, width: 40, height: 28 }; });
await strip('switch-spring', '', [0, 60, 120, 180, 250], sw);
// overshoot: sample transform x at 50% → spring passes beyond the end value
const over = await page.evaluate(async () => { const k = document.querySelector('[data-kv="pushComments"] .ink-switch-knob'); document.querySelector('[data-kv="pushComments"] .ink-switch').click(); await new Promise(requestAnimationFrame); const a = k.getAnimations()[0]; a.pause(); const xs = []; for (const t of [0, 50, 100, 125, 150, 200, 250]) { a.currentTime = t; xs.push(+new DOMMatrix(getComputedStyle(k).transform).m41.toFixed(2)); } a.finish(); return xs; });
const overshoot = Math.min(...over) < -0.3 || Math.max(...over) > 10.3; overshoot ? pass++ : fail++;
rows.push(`| switch spring overshoot | x leaves [0,10] | ${over.join(' → ')} | ${overshoot ? '✅' : '❌'} |`); console.log(overshoot ? 'PASS' : 'FAIL', 'spring overshoot', over);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// 7 hover background: computed transition on interactive rows (100ms ease-out)
const hov = await page.evaluate(() => ['.ink-sb-row', '.ink-topbar-icon', '.ink-card', '.ink-tab-close'].map((s) => { const el = document.querySelector(s); if (!el) return [s, null]; const cs = getComputedStyle(el); const props = cs.transitionProperty.split(',').map((x) => x.trim()); const durs = cs.transitionDuration.split(','); const eas = cs.transitionTimingFunction.split(/,(?![^(]*\))/); const i = Math.max(0, props.findIndex((p) => p.startsWith('background'))); return [s, { prop: props[i], duration: Math.round(parseFloat(durs[i % durs.length]) * 1000), easing: eas[i % eas.length].trim() }]; }));
for (const [s, g] of hov) if (g && s === '.ink-sb-row') check('hover background ' + s, g, { duration: 100, easing: 'ease-out' });
// 8 disclosure chevron rotate: transform 200ms ease-out
await page.hover('.ink-sb-tree'); await page.waitForTimeout(150);
check('toggle chevron rotate', await grab(`document.querySelector('.ink-sb-tree:hover .ink-sb-disclosure')?.click()`, '.ink-sb-tree:hover .ink-sb-disclosure svg'), { duration: 200, easing: 'ease-out' });
await page.waitForTimeout(300);

// 9 topbar idle fade while typing: opacity .7s ease
const tb = await grab(`window.__ink.setUi({ chromeHidden: true })`, '.ink-topbar', { prop: 'opacity' });
check('topbar idle fade', tb, { duration: 700, easing: 'ease' });
await strip('topbar-idle', '.ink-topbar', [0, 175, 350, 525, 700], { x: 220, y: 0, width: 1100, height: 44 });

// 10 tab strip blur fade: opacity 700ms (inactive window)
await page.goto('http://127.0.0.1:5200/window.html?fixture=1&storage=memory&harness=1&theme=light').catch(() => {});
await page.waitForTimeout(800);
const tabs = await page.evaluate(async () => { const el = document.querySelector('.ink-tabbar > *'); if (!el) return null; document.documentElement.classList.add('is-blurred'); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); const a = el.getAnimations()[0]; if (!a) return null; const tm = a.effect.getTiming(); return { duration: Math.round(tm.duration), easing: tm.easing, prop: a.transitionProperty }; });
check('tab strip inactive fade', tabs, { duration: 700, easing: 'ease' });

const md = `# Motion parity\n\nGenerated by \`packages/parity/motion.mjs\` (live Web Animations read back from the running app; frames captured by pausing animations at fixed times).\n\n| interaction | spec | measured | |\n|---|---|---|---|\n${rows.join('\n')}\n\nFrame strips: ${fs.readdirSync(OUT).filter((f) => f.endsWith('-strip.png')).map((f) => '`out/motion/' + f + '`').join(', ')}\n`;
fs.writeFileSync(new URL('./out/motion/MOTION.md', import.meta.url), md);
console.log(`motion: ${pass}/${pass + fail}`, errs.length ? 'errors: ' + errs.join(' | ') : '');
await browser.close();
