import { store, newId } from '../store/store';
import type { Block, BlockType, RichText } from '../store/model';
import type { BlockKind } from './catalog';
import { rtLength, insertText } from './richtext';
import { focusBlock, setBlockSelection } from './registry';
import { indexInParent, insertColumns, setTitle, turnInto } from './commands';
import { navigate } from '../app/state';
import { openInlineMenu } from './inline-menus';
import { openEmojiPicker } from './emoji-picker';
import { openPagePicker } from './page-picker';
import { openEquationEditor } from './equation';

const TEXTISH: BlockType[] = ['text', 'header', 'sub_header', 'sub_sub_header', 'header_4', 'bulleted_list', 'numbered_list', 'to_do', 'toggle', 'quote', 'callout'];

function mk(type: BlockType, parent: string, extra: Partial<Block> = {}): Block {
  return { id: newId(), type, title: [], parent, parentTable: 'block', content: [], alive: true, created: Date.now(), edited: Date.now(), ...extra };
}

/** Apply a slash-menu choice to block `id` whose title (with the "/query" removed) is `title`. */
export function applyKind(id: string, k: BlockKind, title: RichText, at: number) {
  const b = store.get(id)!;
  const empty = rtLength(title) === 0 && TEXTISH.includes(b.type);
  // inline specials keep the block
  if (k.special === 'mentionPerson' || k.special === 'mentionPage' || k.special === 'date') {
    setTitle(id, insertText(title, at, '@'), false);
    focusBlock(id, at + 1);
    requestAnimationFrame(() => openInlineMenu('mention', id, at, '@'));
    return;
  }
  if (k.special === 'emoji') {
    setTitle(id, title, false); focusBlock(id, at);
    requestAnimationFrame(() => openEmojiPicker({ onPick: (ch) => { const cur = store.get(id)!; setTitle(id, insertText(cur.title || [], at, ch), false); focusBlock(id, at + ch.length); } }));
    return;
  }
  if (k.special === 'inlineEquation') {
    const nt: RichText = [...insertText(title, at, '\u0000')].map(([s, m]) => (s === '\u0000' ? ['⁍', { eq: '' }] : [s, m])) as RichText;
    setTitle(id, nt, false);
    requestAnimationFrame(() => openEquationEditor({ blockId: id, inlineAt: at }));
    return;
  }
  if (k.special?.startsWith('columns')) {
    setTitle(id, title, false);
    insertColumns(id, Number(k.special.slice(-1)), empty);
    return;
  }
  if (k.special === 'linkToPage') {
    setTitle(id, title, false);
    const el = document.querySelector(`[data-editable-id="${id}"]`);
    openPagePicker(el?.getBoundingClientRect() || new DOMRect(), (target) => createBlockAt(id, empty, 'alias', { props: { target } }, true));
    return;
  }
  if (k.special === 'page') {
    const pid = createBlockAt(id, empty, 'page', { title: [] }, false, (tx, nid) => { const t = mk('text', nid); tx.create(t); tx.update(nid, { content: [t.id] }); });
    navigate(pid);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.ink-page-title [contenteditable]')?.focus());
    return;
  }
  // text-like turn-into
  if (TEXTISH.includes(k.type) || k.type === 'code') {
    if (empty || b.type === k.type && !!b.format?.toggleable === !!k.toggleable) {
      store.transact('slash', (tx) => tx.update(id, { title }));
      turnInto([id], k.type, { toggleable: k.toggleable });
      focusBlock(id, at);
      return;
    }
    setTitle(id, title, false);
    const nb = mk(k.type, b.parent, { format: k.toggleable ? { toggleable: true } : k.type === 'callout' ? { page_icon: '💡' } : undefined, props: k.type === 'to_do' ? { checked: false } : k.type === 'toggle' || k.toggleable ? { expanded: true } : k.type === 'code' ? { language: 'plain' } : undefined });
    store.transact('insert', (tx) => { tx.create(nb); tx.insertChild(b.parent, nb.id, indexInParent(b) + 1); });
    focusBlock(nb.id, 0);
    return;
  }
  if (k.type === 'synced') {
    const sid = createBlockAt(id, empty, 'synced', {}, false, (tx, nid) => { const t = mk('text', nid); tx.create(t); tx.update(nid, { content: [t.id] }); });
    const child = store.get(sid)!.content![0];
    focusBlock(child, 0);
    return;
  }
  if (k.type === 'table') {
    createBlockAt(id, empty, 'table', { format: { table_has_header: false, table_widths: [120, 120, 120] } }, true, (tx, nid) => {
      const rows = [0, 1, 2].map(() => mk('table_row', nid, { props: { cells: [[], [], []] } }));
      rows.forEach((r) => tx.create(r));
      tx.update(nid, { content: rows.map((r) => r.id) });
    });
    return;
  }
  // non-text blocks
  const extra: Partial<Block> = {};
  if (k.type === 'equation') extra.props = { tex: '' };
  const nid = createBlockAt(id, empty, k.type, extra, true);
  if (k.type === 'equation') requestAnimationFrame(() => openEquationEditor({ blockId: nid }));
  else if (k.type === 'image' || k.type === 'bookmark' || k.type === 'video') requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-block-id="${nid}"] .ink-media-empty`)?.click());
  else setBlockSelection([]);
}

/** Replace the (empty) block or insert after it. Adds a trailing text block for non-text inserts at the end. */
function createBlockAt(id: string, replace: boolean, type: BlockType, extra: Partial<Block>, focusNext: boolean, init?: (tx: any, nid: string) => void): string {
  const b = store.get(id)!;
  const nb = mk(type, b.parent, extra);
  let nextText: Block | null = null;
  store.transact('insert ' + type, (tx) => {
    tx.create(nb);
    const idx = indexInParent(b);
    tx.insertChild(b.parent, nb.id, replace ? idx : idx + 1);
    if (replace) { tx.removeChild(b.parent, id); tx.update(id, { alive: false }); }
    init?.(tx, nb.id);
    if (focusNext && type !== 'page') {
      const p = store.get(b.parent)!;
      const after = (p.content || [])[(p.content || []).indexOf(nb.id) + 1];
      const afterB = after && store.get(after);
      if (!afterB || !TEXTISH.includes(afterB.type)) { nextText = mk('text', b.parent); tx.create(nextText); tx.insertChild(b.parent, nextText.id, (store.get(b.parent)!.content || []).indexOf(nb.id) + 1); }
      else nextText = afterB;
    }
  });
  if (nextText) focusBlock((nextText as Block).id, 0);
  return nb.id;
}
