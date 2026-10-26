/** Copy / paste as HTML, markdown and plain text. */
import type React from 'react';
import { store, newId } from '../store/store';
import type { Block, BlockType, RichText } from '../store/model';
import { rtPlain, toMarkdown, fromMarkdownInline, slice, concat, normalize, escapeHtml, fromDom } from './richtext';
import { getSelectionOffsets } from './caret';
import { setTitle, indexInParent, deleteBlocks } from './commands';
import { focusBlock, getBlockSelection } from './registry';
import { pageTitle } from '../app/pages';

const INK_MIME = 'application/x-inkwell-blocks';

/* ---------- serialization ---------- */
function blockToMarkdown(b: Block, depth: number, num: number): string {
  const ind = '    '.repeat(depth);
  const md = toMarkdown(b.title);
  let line = '';
  switch (b.type) {
    case 'header': line = `# ${md}`; break;
    case 'sub_header': line = `## ${md}`; break;
    case 'sub_sub_header': line = `### ${md}`; break;
    case 'header_4': line = `#### ${md}`; break;
    case 'bulleted_list': line = `- ${md}`; break;
    case 'numbered_list': line = `${num}. ${md}`; break;
    case 'to_do': line = `- [${b.props?.checked ? 'x' : ' '}] ${md}`; break;
    case 'toggle': line = `- ${md}`; break;
    case 'quote': line = `> ${md}`; break;
    case 'callout': line = `> ${b.format?.page_icon || ''} ${md}`; break;
    case 'divider': line = '---'; break;
    case 'code': line = '```' + (b.props?.language && b.props.language !== 'plain' ? b.props.language : '') + '\n' + rtPlain(b.title) + '\n```'; break;
    case 'equation': line = `$$\n${b.props?.tex || ''}\n$$`; break;
    case 'image': line = `![](${b.props?.src || ''})`; break;
    case 'bookmark': case 'video': line = b.props?.url || ''; break;
    case 'page': line = `[${pageTitle(b)}](${b.id})`; break;
    case 'alias': line = `[${pageTitle(b)}](${b.props?.target})`; break;
    case 'table': {
      const rows = store.children(b.id).map((r) => '| ' + (r.props?.cells || []).map((c) => toMarkdown(c as RichText)).join(' | ') + ' |');
      if (rows.length) rows.splice(1, 0, '|' + ' --- |'.repeat((store.children(b.id)[0]?.props?.cells || []).length));
      line = rows.join('\n'); break;
    }
    case 'column_list': case 'column': case 'synced': line = ''; break;
    default: line = md;
  }
  const out = line ? [line.split('\n').map((l) => ind + l).join('\n')] : [];
  if (b.type !== 'page' && b.type !== 'table' && b.type !== 'collection_view_page') {
    let n = 0;
    const childDepth = ['column_list', 'column', 'synced'].includes(b.type) ? depth : depth + 1;
    for (const c of store.children(b.id)) { n = c.type === 'numbered_list' ? n + 1 : 0; out.push(blockToMarkdown(c, childDepth, n)); }
  }
  return out.filter((x) => x !== '').join('\n');
}
export function blocksToMarkdown(ids: string[]): string {
  let n = 0;
  return ids.map((id) => { const b = store.get(id)!; n = b.type === 'numbered_list' ? n + 1 : 0; return blockToMarkdown(b, 0, n); }).join('\n');
}
export function pageToMarkdown(pageId: string): string {
  return `# ${pageTitle(store.get(pageId))}\n\n` + blocksToMarkdown(store.children(pageId).map((c) => c.id));
}

function rtToHtml(rt: RichText | undefined): string {
  return (rt || []).map(([t, m]) => {
    let s = escapeHtml(t);
    if (m?.mention) return '@' + escapeHtml(m.mention.kind === 'user' ? store.users.get(m.mention.id || '')?.name || '' : m.mention.value || pageTitle(store.get(m.mention.id || '')));
    if (m?.eq) return `<code>${escapeHtml(m.eq)}</code>`;
    if (m?.code) s = `<code>${s}</code>`;
    if (m?.b) s = `<strong>${s}</strong>`;
    if (m?.i) s = `<em>${s}</em>`;
    if (m?.u) s = `<u>${s}</u>`;
    if (m?.s) s = `<s>${s}</s>`;
    if (m?.link) s = `<a href="${escapeHtml(m.link)}">${s}</a>`;
    return s;
  }).join('').replace(/\n/g, '<br>');
}
export function blocksToHtml(ids: string[]): string {
  const one = (b: Block): string => {
    const kids = store.children(b.id).filter(() => b.type !== 'page');
    const inner = kids.length ? kidsHtml(kids) : '';
    const t = rtToHtml(b.title);
    switch (b.type) {
      case 'header': return `<h1>${t}</h1>${inner}`;
      case 'sub_header': return `<h2>${t}</h2>${inner}`;
      case 'sub_sub_header': return `<h3>${t}</h3>${inner}`;
      case 'header_4': return `<h4>${t}</h4>${inner}`;
      case 'quote': return `<blockquote>${t}</blockquote>${inner}`;
      case 'code': return `<pre><code>${escapeHtml(rtPlain(b.title))}</code></pre>`;
      case 'divider': return '<hr>';
      case 'to_do': return `<ul><li><input type="checkbox"${b.props?.checked ? ' checked' : ''}> ${t}${inner}</li></ul>`;
      default: return `<p>${t}</p>${inner}`;
    }
  };
  const kidsHtml = (list: Block[]): string => {
    let html = ''; let i = 0;
    while (i < list.length) {
      const b = list[i];
      if (b.type === 'bulleted_list' || b.type === 'numbered_list') {
        const tag = b.type === 'bulleted_list' ? 'ul' : 'ol';
        html += `<${tag}>`;
        while (i < list.length && list[i].type === b.type) { const x = list[i]; html += `<li>${rtToHtml(x.title)}${store.children(x.id).length ? kidsHtml(store.children(x.id)) : ''}</li>`; i++; }
        html += `</${tag}>`;
      } else { html += one(b); i++; }
    }
    return html;
  };
  return `<meta charset="utf-8">` + kidsHtml(ids.map((id) => store.get(id)!).filter(Boolean));
}

function collectTree(id: string): Block[] {
  const b = store.get(id)!; const out = [structuredClone(b)];
  for (const c of store.children(id)) out.push(...collectTree(c.id));
  return out;
}

export function copyBlocks(ids: string[], dt: DataTransfer) {
  dt.setData('text/plain', blocksToMarkdown(ids));
  dt.setData('text/html', blocksToHtml(ids));
  dt.setData(INK_MIME, JSON.stringify({ roots: ids, blocks: ids.flatMap(collectTree) }));
}

/* ---------- handlers on editables ---------- */
export function handleCopy(e: React.ClipboardEvent) {
  const sel = getSelection(); if (!sel || sel.isCollapsed) return;
  const frag = sel.getRangeAt(0).cloneContents();
  const div = document.createElement('div'); div.appendChild(frag);
  const rt = fromDom(div);
  e.preventDefault();
  e.clipboardData.setData('text/plain', rtPlain(rt));
  e.clipboardData.setData('text/html', `<meta charset="utf-8">${rtToHtml(rt)}`);
  e.clipboardData.setData('text/x-inkwell-rt', JSON.stringify(rt));
}
export function handleCut(e: React.ClipboardEvent, id: string, el: HTMLElement) {
  handleCopy(e);
  const o = getSelectionOffsets(el); if (!o || o.start === o.end) return;
  const b = store.get(id)!;
  setTitle(id, concat(slice(b.title || [], 0, o.start), slice(b.title || [], o.end)), false, { start: o.start, end: o.start });
  focusBlock(id, o.start);
}

export interface ParsedBlock { type: BlockType; title: RichText; props?: Block['props']; children: ParsedBlock[]; format?: Block['format'] }

/** Markdown → block tree (supports headings, lists with indentation, to-dos, quotes, code fences, dividers, tables). */
export function parseMarkdown(src: string): ParsedBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const root: ParsedBlock[] = [];
  const stack: { indent: number; list: ParsedBlock[] }[] = [{ indent: -1, list: root }];
  let i = 0;
  const push = (indent: number, b: ParsedBlock) => {
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].list.push(b);
    stack.push({ indent, list: b.children });
  };
  while (i < lines.length) {
    const raw = lines[i];
    const indent = (raw.match(/^\s*/)![0].replace(/\t/g, '    ').length);
    const line = raw.trim();
    if (!line) { i++; continue; }
    let m: RegExpMatchArray | null;
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim().toLowerCase() || 'plain';
      const body: string[] = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++].slice(Math.min(indent, lines[i - 1].search(/\S|$/))));
      i++;
      push(indent, { type: 'code', title: [[body.join('\n')]], props: { language: lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : lang }, children: [] });
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const r = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
        if (!r.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(r);
        i++;
      }
      const t: ParsedBlock = { type: 'table', title: [], format: { table_has_header: true, table_widths: rows[0]?.map(() => 120) }, children: rows.map((r) => ({ type: 'table_row', title: [], props: { cells: r.map((c) => fromMarkdownInline(c)) }, children: [] })) };
      push(indent, t);
      continue;
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) push(indent, { type: (['header', 'sub_header', 'sub_sub_header', 'header_4'] as BlockType[])[m[1].length - 1], title: fromMarkdownInline(m[2]), children: [] });
    else if ((m = line.match(/^[-*+]\s+\[([ xX])\](?:\s+(.*))?$/))) push(indent, { type: 'to_do', title: fromMarkdownInline(m[2] ?? ''), props: { checked: m[1].toLowerCase() === 'x' }, children: [] });
    else if ((m = line.match(/^[-*+](?:\s+(.*))?$/))) push(indent, { type: 'bulleted_list', title: fromMarkdownInline(m[1] ?? ''), children: [] });
    else if ((m = line.match(/^(\d+)[.)]()$/) || line.match(/^(\d+|[a-z]|[ivx]+)[.)]\s+(.*)$/))) push(indent, { type: 'numbered_list', title: fromMarkdownInline(m[2]), children: [] });
    else if ((m = line.match(/^>\s?(.*)$/))) push(indent, { type: 'quote', title: fromMarkdownInline(m[1]), children: [] });
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) push(indent, { type: 'divider', title: [], children: [] });
    else if ((m = line.match(/^\$\$(.*)\$\$$/))) push(indent, { type: 'equation', title: [], props: { tex: m[1] }, children: [] });
    else push(indent, { type: 'text', title: fromMarkdownInline(line), children: [] });
    i++;
  }
  return root;
}

export function htmlToBlocks(html: string): ParsedBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: ParsedBlock[] = [];
  const inline = (el: Element): RichText => { const tmp = document.createElement('div'); tmp.innerHTML = el.innerHTML; return fromDom(tmp); };
  const walk = (el: Element, list: ParsedBlock[]) => {
    for (const c of Array.from(el.children)) {
      const tag = c.tagName;
      if (/^H[1-6]$/.test(tag)) list.push({ type: (['header', 'sub_header', 'sub_sub_header', 'header_4', 'header_4', 'header_4'] as BlockType[])[+tag[1] - 1], title: inline(c), children: [] });
      else if (tag === 'P' || tag === 'DIV' && !c.querySelector('p,div,ul,ol,h1,h2,h3,pre,blockquote')) { const rt = inline(c); if (rtPlain(rt).trim()) list.push({ type: 'text', title: rt, children: [] }); }
      else if (tag === 'UL' || tag === 'OL') {
        for (const li of Array.from(c.children)) {
          if (li.tagName !== 'LI') continue;
          const cb = li.querySelector(':scope > input[type=checkbox]');
          const clone = li.cloneNode(true) as Element; clone.querySelectorAll(':scope > ul, :scope > ol, :scope > input').forEach((n) => n.remove());
          const b: ParsedBlock = { type: cb ? 'to_do' : tag === 'UL' ? 'bulleted_list' : 'numbered_list', title: normalize(inline(clone).map(([t, m]) => [t.replace(/^\s+/, ''), m]) as RichText), props: cb ? { checked: (cb as HTMLInputElement).checked } : undefined, children: [] };
          for (const sub of Array.from(li.children)) if (sub.tagName === 'UL' || sub.tagName === 'OL') { const w = document.createElement('div'); w.appendChild(sub.cloneNode(true)); walk(w, b.children); }
          list.push(b);
        }
      }
      else if (tag === 'BLOCKQUOTE') list.push({ type: 'quote', title: inline(c), children: [] });
      else if (tag === 'PRE') list.push({ type: 'code', title: [[c.textContent || '']], props: { language: 'plain' }, children: [] });
      else if (tag === 'HR') list.push({ type: 'divider', title: [], children: [] });
      else if (c.children.length) walk(c, list);
      else if ((c.textContent || '').trim()) list.push({ type: 'text', title: inline(c), children: [] });
    }
  };
  walk(doc.body, out);
  return out;
}

function insertParsed(afterId: string, parsed: ParsedBlock[], replaceEmpty: boolean): string | null {
  const after = store.get(afterId)!;
  let lastId: string | null = null;
  store.transact('paste', (tx) => {
    let idx = indexInParent(after) + 1;
    const mk = (pb: ParsedBlock, parent: string): string => {
      const id = newId();
      const kids = pb.children.map((c) => mk(c, id));
      tx.create({ id, type: pb.type, title: pb.title, props: pb.props, format: pb.format, parent, parentTable: 'block', content: kids });
      return id;
    };
    for (const pb of parsed) { const id = mk(pb, after.parent); tx.insertChild(after.parent, id, idx++); lastId = id; }
    if (replaceEmpty) { tx.removeChild(after.parent, afterId); tx.update(afterId, { alive: false }); }
  });
  return lastId;
}

export function handlePaste(e: React.ClipboardEvent, id: string, el: HTMLElement, opts: { code: boolean; cell: boolean; onChange?: (rt: RichText) => void }) {
  const dt = e.clipboardData;
  const b = store.get(id); if (!b) return;
  const o = getSelectionOffsets(el) || { start: 0, end: 0 };
  const plainText = dt.getData('text/plain');
  e.preventDefault();
  if (opts.code || opts.cell) { document.execCommand('insertText', false, plainText); return; }
  const inkBlocks = dt.getData(INK_MIME);
  const inkRt = dt.getData('text/x-inkwell-rt');
  const html = dt.getData('text/html');
  const title = b.title || [];
  const isEmpty = rtPlain(title).length === 0 && b.type === 'text';
  if (inkBlocks) {
    const { roots, blocks } = JSON.parse(inkBlocks) as { roots: string[]; blocks: Block[] };
    const byId = new Map(blocks.map((x) => [x.id, x]));
    const toParsed = (bid: string): ParsedBlock => { const x = byId.get(bid)!; return { type: x.type, title: x.title || [], props: x.props, format: x.format, children: (x.content || []).filter((c) => byId.has(c)).map(toParsed) }; };
    const last = insertParsed(id, roots.map(toParsed), isEmpty);
    if (last) focusBlock(last, 'end');
    return;
  }
  // single-line rich text paste stays inline
  let inline: RichText | null = null;
  if (inkRt) inline = JSON.parse(inkRt);
  const urlOnly = /^https?:\/\/\S+$/.test(plainText.trim());
  if (!inline && urlOnly) {
    if (o.start !== o.end) { setTitle(id, concat(slice(title, 0, o.start), slice(title, o.start, o.end).map(([t, m]) => [t, { ...(m || {}), link: plainText.trim() }]) as RichText, slice(title, o.end)), false); focusBlock(id, o.end); return; }
    inline = [[plainText.trim(), { link: plainText.trim() }]];
  }
  let parsed: ParsedBlock[] | null = null;
  if (!inline) {
    if (html && !/^\s*<meta[^>]*>\s*[^<]*$/.test(html)) parsed = htmlToBlocks(html);
    else parsed = parseMarkdown(plainText);
    if (parsed.length === 1 && parsed[0].type === 'text' && !parsed[0].children.length) { inline = parsed[0].title; parsed = null; }
  }
  if (inline) {
    const nt = concat(slice(title, 0, o.start), inline, slice(title, o.end));
    const at = o.start + inline.reduce((n, s) => n + s[0].length, 0);
    setTitle(id, nt, false, { start: at, end: at });
    focusBlock(id, at);
    return;
  }
  if (!parsed?.length) return;
  // split current block at caret: text before stays; pasted blocks; text after appended to last
  const after = slice(title, o.end);
  setTitle(id, slice(title, 0, o.start), false);
  const last = insertParsed(id, parsed, isEmpty);
  if (last && rtPlain(after)) { const lb = store.get(last)!; setTitle(last, concat(lb.title || [], after), false); }
  if (last) focusBlock(last, 'end');
}

/** page-level copy/cut/paste when blocks are selected */
export function installBlockClipboard(host: HTMLElement) {
  const onCopy = (e: ClipboardEvent) => { const ids = getBlockSelection(); if (!ids.length || !e.clipboardData) return; e.preventDefault(); copyBlocks(ids, e.clipboardData); };
  const onCut = (e: ClipboardEvent) => { const ids = getBlockSelection(); if (!ids.length || !e.clipboardData) return; e.preventDefault(); copyBlocks(ids, e.clipboardData); deleteBlocks(ids); };
  const onPaste = (e: ClipboardEvent) => {
    const ids = getBlockSelection(); if (!ids.length || !e.clipboardData) return;
    e.preventDefault();
    const last = ids[ids.length - 1];
    const txt = e.clipboardData.getData('text/plain');
    const ink = e.clipboardData.getData(INK_MIME);
    let parsed: ParsedBlock[];
    if (ink) { const { roots, blocks } = JSON.parse(ink); const byId = new Map<string, Block>(blocks.map((x: Block) => [x.id, x])); const tp = (bid: string): ParsedBlock => { const x = byId.get(bid)!; return { type: x.type, title: x.title || [], props: x.props, format: x.format, children: (x.content || []).filter((c) => byId.has(c)).map(tp) }; }; parsed = roots.map(tp); }
    else parsed = parseMarkdown(txt);
    const l = insertParsed(last, parsed, false);
    if (l) focusBlock(l, 'end');
  };
  host.addEventListener('copy', onCopy); host.addEventListener('cut', onCut); host.addEventListener('paste', onPaste);
  return () => { host.removeEventListener('copy', onCopy); host.removeEventListener('cut', onCut); host.removeEventListener('paste', onPaste); };
}
