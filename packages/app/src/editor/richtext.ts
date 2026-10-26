/** Rich text utilities over the segment model `[text, marks?][]`. Offsets are UTF-16 code units. */
import type { Marks, RichText, Seg } from '../store/model';

export const rtLength = (rt: RichText | undefined) => (rt || []).reduce((n, s) => n + s[0].length, 0);
export const rtPlain = (rt: RichText | undefined) => (rt || []).map((s) => s[0]).join('');

const MARK_KEYS: (keyof Marks)[] = ['b', 'i', 'u', 's', 'code', 'color', 'link', 'eq', 'mention'];
export function marksEqual(a?: Marks, b?: Marks): boolean {
  for (const k of MARK_KEYS) {
    const x = a?.[k], y = b?.[k];
    if (typeof x === 'object' || typeof y === 'object') { if (JSON.stringify(x) !== JSON.stringify(y)) return false; }
    else if ((x ?? undefined) !== (y ?? undefined)) return false;
  }
  return true;
}
const clean = (m?: Marks): Marks | undefined => {
  if (!m) return undefined;
  const o: Marks = {};
  for (const k of MARK_KEYS) if (m[k] !== undefined && m[k] !== null && m[k] !== '' as any) (o as any)[k] = m[k];
  return Object.keys(o).length ? o : undefined;
};
const atomic = (m?: Marks) => !!(m?.eq || m?.mention);

/** Merge adjacent segments with identical marks; drop empties. Atomic segments never merge. */
export function normalize(rt: RichText): RichText {
  const out: RichText = [];
  for (const [text, m0] of rt) {
    if (!text) continue;
    const m = clean(m0);
    const last = out[out.length - 1];
    if (last && !atomic(m) && !atomic(last[1]) && marksEqual(last[1], m)) last[0] += text;
    else out.push(m ? [text, m] : [text]);
  }
  return out;
}

export function slice(rt: RichText, start: number, end = Infinity): RichText {
  const out: RichText = [];
  let pos = 0;
  for (const [text, m] of rt) {
    const s = pos, e = pos + text.length;
    pos = e;
    if (e <= start || s >= end) continue;
    const a = Math.max(start, s) - s, b = Math.min(end, e) - s;
    out.push(m ? [text.slice(a, b), { ...m }] : [text.slice(a, b)]);
  }
  return normalize(out);
}
export const concat = (...parts: RichText[]): RichText => normalize(parts.flat().map((s) => [s[0], s[1]] as Seg));

/** Marks active at an offset (for typing continuation): marks of the char before. */
export function marksAt(rt: RichText, offset: number): Marks | undefined {
  let pos = 0;
  for (const [text, m] of rt) {
    if (offset > pos && offset <= pos + text.length) return atomic(m) ? undefined : m;
    pos += text.length;
  }
  return undefined;
}

export function insertText(rt: RichText, offset: number, text: string, marks?: Marks): RichText {
  return concat(slice(rt, 0, offset), [[text, marks]], slice(rt, offset));
}
export function deleteRange(rt: RichText, start: number, end: number): RichText {
  return concat(slice(rt, 0, start), slice(rt, end));
}

export type MarkKey = 'b' | 'i' | 'u' | 's' | 'code';
/** true when every character in range has the mark */
export function rangeHasMark(rt: RichText, start: number, end: number, key: keyof Marks, value?: unknown): boolean {
  if (start >= end) return false;
  const part = slice(rt, start, end);
  return part.length > 0 && part.every(([, m]) => (value === undefined ? !!m?.[key] : m?.[key] === value));
}
export function applyMark(rt: RichText, start: number, end: number, fn: (m: Marks) => Marks): RichText {
  const mid = slice(rt, start, end).map(([t, m]) => [t, atomic(m) ? m : clean(fn({ ...(m || {}) }))] as Seg);
  return concat(slice(rt, 0, start), mid, slice(rt, end));
}
export function toggleMark(rt: RichText, start: number, end: number, key: MarkKey): RichText {
  const on = !rangeHasMark(rt, start, end, key);
  return applyMark(rt, start, end, (m) => { if (on) (m as any)[key] = 1; else delete m[key]; return m; });
}
export function setColor(rt: RichText, start: number, end: number, color: string | undefined): RichText {
  return applyMark(rt, start, end, (m) => { if (color && color !== 'default') m.color = color; else delete m.color; return m; });
}
export function setLink(rt: RichText, start: number, end: number, link: string | undefined): RichText {
  return applyMark(rt, start, end, (m) => { if (link) m.link = link; else delete m.link; return m; });
}
export function clearFormatting(rt: RichText, start: number, end: number): RichText {
  return applyMark(rt, start, end, (m) => ({ link: m.link } as Marks));
}

/** Find the [start,end) of the link around offset. */
export function linkRangeAt(rt: RichText, offset: number): { start: number; end: number; href: string } | null {
  let pos = 0;
  for (const [text, m] of rt) {
    const s = pos, e = pos + text.length;
    pos = e;
    if (m?.link && offset >= s && offset <= e) {
      // extend over neighbouring segments with the same link
      let start = s, end = e, p = 0;
      for (const [t2, m2] of rt) { const a = p, b = p + t2.length; p = b; if (m2?.link === m.link) { if (b === start) start = a; if (a === end) end = b; } }
      return { start, end, href: m.link };
    }
  }
  return null;
}

/* ---------- HTML rendering ---------- */
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface RenderCtx {
  mention?: (m: NonNullable<Marks['mention']>) => string;
  equation?: (tex: string) => string;
}
export function colorClass(c?: string) { return c ? (c.endsWith('_background') ? `ink-bg-${c.replace('_background', '')}` : `ink-fg-${c}`) : ''; }

/** Render rich text to HTML for a contenteditable. Atomic tokens are non-editable spans with data-token. */
export function toHtml(rt: RichText | undefined, ctx: RenderCtx = {}): string {
  let html = '';
  for (const [text, m] of rt || []) {
    if (m?.mention) { html += `<span class="ink-mention" contenteditable="false" data-token="mention" data-mention='${escapeHtml(JSON.stringify(m.mention))}'>${ctx.mention ? ctx.mention(m.mention) : '@'}</span>`; continue; }
    if (m?.eq) { html += `<span class="ink-inline-eq" contenteditable="false" data-token="eq" data-tex="${escapeHtml(m.eq)}">${ctx.equation ? ctx.equation(m.eq) : escapeHtml(m.eq)}</span>`; continue; }
    let inner = escapeHtml(text);
    if (!m) { html += inner; continue; }
    const cls: string[] = [];
    if (m.b) cls.push('ink-b');
    if (m.i) cls.push('ink-i');
    if (m.u) cls.push('ink-u');
    if (m.s) cls.push('ink-s');
    if (m.code) cls.push('ink-code');
    if (m.color) cls.push(colorClass(m.color));
    const attrs = `data-m="${escapeHtml(JSON.stringify(m))}"`;
    if (m.link) inner = `<a class="ink-link${cls.length ? ' ' + cls.join(' ') : ''}" href="${escapeHtml(m.link)}" ${attrs}>${inner}</a>`;
    else inner = `<span class="${cls.join(' ')}" ${attrs}>${inner}</span>`;
    html += inner;
  }
  return html;
}

/** Parse the DOM of a contenteditable back to rich text. */
export function fromDom(root: Node): RichText {
  const out: RichText = [];
  const walk = (node: Node, marks: Marks | undefined) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').replace(/\u200b/g, '');
      if (t) out.push(marks ? [t, { ...marks }] : [t]);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.token === 'mention') { out.push(['‣', { mention: JSON.parse(node.dataset.mention || '{}') }]); return; }
    if (node.dataset.token === 'eq') { out.push(['⁍', { eq: node.dataset.tex || '' }]); return; }
    if (node.tagName === 'BR') { if (node.nextSibling || node.parentNode !== root) out.push(['\n']); return; }
    if (node.dataset.placeholder !== undefined) return;
    let m = marks;
    if (node.dataset.m) { try { m = { ...(marks || {}), ...JSON.parse(node.dataset.m) }; } catch {} }
    else {
      // foreign formatting (e.g. browser-inserted <b>)
      const tag = node.tagName;
      const add: Marks = {};
      if (tag === 'B' || tag === 'STRONG') add.b = 1;
      if (tag === 'I' || tag === 'EM') add.i = 1;
      if (tag === 'U') add.u = 1;
      if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') add.s = 1;
      if (tag === 'CODE') add.code = 1;
      if (tag === 'A' && node.getAttribute('href')) add.link = node.getAttribute('href')!;
      if (Object.keys(add).length) m = { ...(marks || {}), ...add };
    }
    if ((node.tagName === 'DIV' || node.tagName === 'P') && node !== root && out.length && !rtPlain(out).endsWith('\n')) out.push(['\n']);
    node.childNodes.forEach((c) => walk(c, m));
  };
  root.childNodes.forEach((c) => walk(c, undefined));
  return normalize(out);
}

/* ---------- Markdown / plain conversions ---------- */
export function toMarkdown(rt: RichText | undefined): string {
  return (rt || []).map(([t, m]) => {
    if (m?.mention) return m.mention.kind === 'date' ? `@${m.mention.value}` : '@mention';
    if (m?.eq) return `$${m.eq}$`;
    let s = t;
    if (m?.code) s = '`' + s + '`';
    if (m?.b) s = `**${s}**`;
    if (m?.i) s = `*${s}*`;
    if (m?.s) s = `~~${s}~~`;
    if (m?.link) s = `[${s}](${m.link})`;
    return s;
  }).join('');
}
/** Inline markdown → rich text (bold, italic, code, strike, links, $eq$). */
export function fromMarkdownInline(src: string): RichText {
  const out: RichText = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|~~([^~]+)~~|\[([^\]]+)\]\(([^)]+)\)|\$([^$]+)\$)/g;
  let last = 0, mm: RegExpExecArray | null;
  while ((mm = re.exec(src))) {
    if (mm.index > last) out.push([src.slice(last, mm.index)]);
    if (mm[2] || mm[3]) out.push([mm[2] || mm[3], { b: 1 }]);
    else if (mm[4] || mm[5]) out.push([mm[4] || mm[5], { i: 1 }]);
    else if (mm[6]) out.push([mm[6], { code: 1 }]);
    else if (mm[7]) out.push([mm[7], { s: 1 }]);
    else if (mm[8]) out.push([mm[8], { link: mm[9] }]);
    else if (mm[10]) out.push(['⁍', { eq: mm[10] }]);
    last = mm.index + mm[0].length;
  }
  if (last < src.length) out.push([src.slice(last)]);
  return normalize(out);
}
