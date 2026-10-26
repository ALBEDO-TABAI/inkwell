// Inkwell token pipeline.
// Reads the measured theme value tables in ./src and emits CSS custom properties
// under our own naming scheme (--ink-*), for light / dark and high-contrast variants.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => JSON.parse(fs.readFileSync(path.join(here, 'src', f), 'utf8'));
const outDir = path.join(here, 'generated');
fs.mkdirSync(outDir, { recursive: true });

const theme = src('theme-all.json');
const electron = src('electron-colors.json');
const classic = src('palette-classic.json').deprecatedPalette;

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
const HUES = ['blue', 'brown', 'gray', 'green', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow'];
const SEMANTIC = ['text', 'icon', 'border', 'background'];

/** flatten nested object into [pathArray, value] */
function flatten(obj, prefix = []) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') out.push(...flatten(v, [...prefix, k]));
    else out.push([[...prefix, k], v]);
  }
  return out;
}

const modes = { light: {}, dark: {} };
for (const [key, byMode] of Object.entries(theme)) {
  for (const mode of ['light', 'dark']) {
    const v = byMode[mode];
    if (v === undefined) continue;
    if (v && typeof v === 'object') {
      for (const [p, val] of flatten(v, [key])) modes[mode][p.map(kebab).join('-')] = String(val);
    } else modes[mode][kebab(key)] = String(v);
  }
}
// desktop chrome colours (tab bar etc.)
const hcModes = { light: {}, dark: {} };
for (const [key, byMode] of Object.entries(electron)) {
  const name = 'chrome-' + kebab(key).replace(/notion/g, 'app'); // never ship the reference brand name
  modes.light[name] = byMode.light; modes.dark[name] = byMode.dark;
  if (byMode.lightHighContrast) hcModes.light[name] = byMode.lightHighContrast;
  if (byMode.darkHighContrast) hcModes.dark[name] = byMode.darkHighContrast;
}
// classic palette steps (used for hover/pressed variants of block colours)
for (const mode of ['light', 'dark']) {
  const pal = classic[mode] || {};
  for (const [hue, steps] of Object.entries(pal)) {
    if (steps && typeof steps === 'object') for (const [step, val] of Object.entries(steps)) modes[mode][`classic-${kebab(hue)}-${step}`] = String(val);
  }
}

// High contrast: the value table is keyed by abbreviated semantic paths
// (first three letters of each camel-case word). Build the same abbreviation
// for our flattened semantic keys and map the values over.
function abbrev(parts) {
  const words = parts.flatMap((p) => p.replace(/([a-z])([A-Z])/g, '$1 $2').split(' '));
  let translucent = false;
  const ws = words.filter((w) => { if (w === 'Translucent') { translucent = true; return false; } return true; });
  const a = ws.map((w, i) => { const t = w.slice(0, 3); return i === 0 ? t.toLowerCase() : t[0].toUpperCase() + t.slice(1).toLowerCase(); }).join('');
  return (translucent ? '--ca-' : '--c-') + a + (translucent ? 'Tra' : '');
}
const hcCss = fs.readFileSync(path.join(here, 'src', 'highcontrast-values.css'), 'utf8');
function parseBlock(selectorNeedle) {
  const map = {};
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(hcCss))) {
    if (!m[1].includes(selectorNeedle) || m[1].includes('auto')) continue;
    for (const decl of m[2].split(';')) { const i = decl.indexOf(':'); if (i > 0) map[decl.slice(0, i).trim()] = decl.slice(i + 1).trim(); }
  }
  return map;
}
const hcSrc = { light: parseBlock('.notion-light-theme'), dark: parseBlock('.notion-dark-theme') };
for (const mode of ['light', 'dark']) {
  for (const key of Object.keys(theme)) {
    const isHue = HUES.includes(key);
    if (!isHue && !SEMANTIC.includes(key)) continue;
    const v = theme[key][mode];
    for (const [p] of flatten(v, [key])) {
      const ab = abbrev(isHue ? p : p);
      const val = hcSrc[mode][ab];
      if (val) hcModes[mode][p.map(kebab).join('-')] = val;
    }
  }
}

// Non-colour scale tokens (from measured values, SPEC §5)
const scale = {
  'font-sans': 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
  'font-sans-zh': 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", Helvetica, "PingFang SC", "Microsoft YaHei", "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
  'font-serif': '"Source Serif 4", "Newsreader", Georgia, ui-serif, serif',
  'font-mono': '"IBM Plex Mono", "JetBrains Mono", Menlo, Courier, monospace',
  'font-code': 'SFMono-Regular, Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace',
  'radius-3': '3px', 'radius-4': '4px', 'radius-6': '6px', 'radius-8': '8px', 'radius-10': '10px', 'radius-12': '12px', 'radius-14': '14px', 'radius-16': '16px', 'radius-20': '20px', 'radius-pill': '9999px',
  'tab-bar-height': '36px', 'topbar-height': '44px', 'sidebar-width': '270px', 'sidebar-min': '270px', 'sidebar-max': '600px',
  'page-width': '900px', 'page-padding': '96px', 'content-width': '708px',
  'z-sticky': '10', 'z-topbar': '100', 'z-sidebar': '111', 'z-sidebar-floating': '202', 'z-overlay': '999', 'z-toast': '1100',
  'ease-spring': 'cubic-bezier(.34,1.56,.64,1)',
};

const toCss = (vars) => Object.entries(vars).map(([k, v]) => `  --ink-${k}: ${v};`).join('\n');
let css = `/* GENERATED by packages/tokens/build.mjs — do not edit. */\n`;
css += `:root {\n${toCss(scale)}\n}\n`;
css += `:root, [data-theme="light"] {\n  color-scheme: light;\n${toCss(modes.light)}\n}\n`;
css += `[data-theme="dark"] {\n  color-scheme: dark;\n${toCss(modes.dark)}\n}\n`;
css += `[data-contrast="high"][data-theme="light"], [data-contrast="high"] [data-theme="light"] {\n${toCss(hcModes.light)}\n}\n`;
css += `[data-contrast="high"][data-theme="dark"], [data-contrast="high"] [data-theme="dark"] {\n${toCss(hcModes.dark)}\n}\n`;
css += `@media (prefers-contrast: more) {\n  [data-contrast="auto"][data-theme="light"] {\n${toCss(hcModes.light)}\n  }\n  [data-contrast="auto"][data-theme="dark"] {\n${toCss(hcModes.dark)}\n  }\n}\n`;
fs.writeFileSync(path.join(outDir, 'tokens.css'), css);
fs.writeFileSync(path.join(outDir, 'tokens.json'), JSON.stringify({ scale, light: modes.light, dark: modes.dark, lightHighContrast: hcModes.light, darkHighContrast: hcModes.dark }, null, 1));
console.log(`tokens: ${Object.keys(modes.light).length} light, ${Object.keys(modes.dark).length} dark, ${Object.keys(hcModes.light).length}/${Object.keys(hcModes.dark).length} HC vars`);
