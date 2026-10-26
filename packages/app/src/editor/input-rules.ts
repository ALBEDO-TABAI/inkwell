/** Markdown shortcuts and inline-menu triggers, run after each input. */
import { store } from '../store/store';
import type { BlockType, RichText } from '../store/model';
import { rtPlain, slice, concat, deleteRange } from './richtext';
import { turnInto, setTitle, insertAfter } from './commands';
import { focusBlock } from './registry';
import { openInlineMenu, updateInlineQuery, isInlineMenuOpen, getSession } from './inline-menus';
import { indexInParent } from './commands';
import { newId } from '../store/store';

const BLOCK_RULES: { re: RegExp; type: BlockType; toggleable?: boolean; checked?: boolean }[] = [
  { re: /^#{1}\s$/, type: 'header' },
  { re: /^#{2}\s$/, type: 'sub_header' },
  { re: /^#{3}\s$/, type: 'sub_sub_header' },
  { re: /^#{4}\s$/, type: 'header_4' },
  { re: /^>#\s$/, type: 'header', toggleable: true },
  { re: /^>##\s$/, type: 'sub_header', toggleable: true },
  { re: /^>###\s$/, type: 'sub_sub_header', toggleable: true },
  { re: /^[-*+]\s$/, type: 'bulleted_list' },
  { re: /^(\d+|[a-zA-Z]|[ivxIVX]+)\.\s$/, type: 'numbered_list' },
  { re: /^\[\s?\]\s$/, type: 'to_do', checked: false },
  { re: /^\[x\]\s$/i, type: 'to_do', checked: true },
  { re: /^>\s$/, type: 'toggle' },
  { re: /^["“]\s$/, type: 'quote' },
  { re: /^\|\s$/, type: 'quote' },
];
const INLINE_RULES: { re: RegExp; mark: 'b' | 'i' | 'code' | 's' | 'eq' }[] = [
  { re: /(\*\*)([^*\s][^*]*?)\*\*$/, mark: 'b' },
  { re: /(__)([^_\s][^_]*?)__$/, mark: 'b' },
  { re: /(?<![*\w])(\*)([^*\s][^*]*?)\*$/, mark: 'i' },
  { re: /(?<![_\w])(_)([^_\s][^_]*?)_$/, mark: 'i' },
  { re: /(`)([^`]+)`$/, mark: 'code' },
  { re: /(~~)([^~]+)~~$/, mark: 's' },
  { re: /(?<![~])(~)([^~\s][^~]*?)~$/, mark: 's' },
  { re: /(?<![$])(\$)([^$\s][^$]*?)\$$/, mark: 'eq' },
];

export function afterInput(id: string, _el: HTMLElement, caret: number) {
  const b = store.get(id); if (!b) return;
  const title = b.title || [];
  const text = rtPlain(title);
  const before = text.slice(0, caret);
  const typed = before.slice(-1);

  if (isInlineMenuOpen()) { updateInlineQuery(id, caret, text); if (getSession()) return; }

  if (b.type !== 'code') {
    // block rules: only when the prefix is the whole text before the caret
    if (typed === ' ' || typed === '\u00a0') {
      const prefix = before.replace(/\u00a0/g, ' ');
      for (const r of BLOCK_RULES) {
        if (r.re.test(prefix)) {
          if (r.type === b.type && !!r.toggleable === !!b.format?.toggleable) break;
          const rest = slice(title, caret);
          store.transact('markdown', (tx) => tx.update(id, { title: rest }));
          turnInto([id], r.type, { toggleable: r.toggleable });
          if (r.type === 'to_do') store.transact('check', (tx) => tx.update(id, (x) => ({ props: { ...x.props, checked: !!r.checked } })), { noUndo: true });
          focusBlock(id, 0);
          return;
        }
      }
    }
    if (before === '---' && caret === 3) { turnIntoDivider(id, slice(title, 3)); return; }
    if (before === '```' && caret === 3) {
      store.transact('markdown', (tx) => tx.update(id, { title: slice(title, 3) }));
      turnInto([id], 'code'); focusBlock(id, 0); return;
    }
    if (before.endsWith('$$') && before.length === 2 && caret === 2) {
      store.transact('markdown', (tx) => tx.update(id, { type: 'equation', title: [], props: { ...b.props, tex: '' } }));
      import('./equation').then((m) => m.openEquationEditor({ blockId: id }));
      return;
    }
    // inline marks
    for (const r of INLINE_RULES) {
      const m = r.re.exec(before);
      if (!m) continue;
      const delim = m[1], inner = m[2];
      const delimLen = delim.length;
      const start = caret - inner.length - 2 * delimLen;
      // do not trigger inside inline code
      const pre = slice(title, 0, start), body = slice(title, start + delimLen, caret - delimLen), post = slice(title, caret);
      let mid: RichText;
      if (r.mark === 'eq') mid = [['⁍', { eq: inner }]];
      else mid = body.map(([s, mm]) => [s, { ...(mm || {}), [r.mark]: 1 }]) as RichText;
      const nt = concat(pre, mid, post);
      const newCaret = start + (r.mark === 'eq' ? 1 : inner.length);
      setTitle(id, nt, false, { start: newCaret, end: newCaret });
      focusBlock(id, newCaret);
      return;
    }
  }
  // inline menu triggers
  const prevCh = before.slice(-2, -1);
  if (typed === '/' && b.type !== 'code') { openInlineMenu('slash', id, caret - 1, '/'); return; }
  if (typed === '@' && b.type !== 'code' && (!prevCh || /\s|[\u3000-\u9fff]/.test(prevCh))) { openInlineMenu('mention', id, caret - 1, '@'); return; }
  if (before.endsWith('[[') && b.type !== 'code') {
    const nt = deleteRange(title, caret - 2, caret);
    const withAt = concat(slice(nt, 0, caret - 2), [['@']], slice(nt, caret - 2));
    setTitle(id, withAt, false, { start: caret - 1, end: caret - 1 }); focusBlock(id, caret - 1);
    setTimeout(() => { focusBlock(id, caret - 1); openInlineMenu('mention', id, caret - 2, '@', { pagesOnly: true }); }, 16);
    return;
  }
  if (typed === ':' && b.type !== 'code' && (!prevCh || /\s/.test(prevCh))) { openInlineMenu('emoji', id, caret - 1, ':'); return; }
}

function turnIntoDivider(id: string, rest: RichText) {
  const b = store.get(id)!;
  const nid = newId();
  store.transact('divider', (tx) => {
    tx.update(id, { type: 'divider', title: [] });
    tx.create({ id: nid, type: 'text', title: rest, parent: b.parent, parentTable: 'block', content: [] });
    tx.insertChild(b.parent, nid, indexInParent(b) + 1);
  });
  focusBlock(nid, 0);
  void insertAfter;
}
