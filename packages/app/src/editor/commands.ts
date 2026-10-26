import { store, newId } from '../store/store';
import type { Block, BlockType, RichText } from '../store/model';
import { HEADINGS } from '../store/model';
import { slice, concat, rtLength } from './richtext';
import { focusBlock, setBlockSelection, visibleBlocks, focusableBlocks, NON_TEXT, isCollapsed } from './registry';

export const LISTISH: BlockType[] = ['bulleted_list', 'numbered_list', 'to_do', 'toggle'];
export const isListish = (b?: Block) => !!b && LISTISH.includes(b.type);
const canHaveChildren = (b?: Block) => !!b && !['divider', 'image', 'bookmark', 'video', 'equation', 'code', 'table_of_contents', 'breadcrumb', 'alias', 'table', 'table_row', 'collection_view_page', 'collection_view'].includes(b.type);
const isContainer = (b?: Block) => !!b && (b.type === 'page' || b.type === 'column' || b.type === 'synced' || b.type === 'callout');

export function pageIdOf(id: string) { return store.pageOf(id)?.id || ''; }
export function indexInParent(b: Block) { return (store.get(b.parent)?.content || []).indexOf(b.id); }
export function prevSibling(b: Block) { const p = store.get(b.parent); if (!p) return; const i = (p.content || []).indexOf(b.id); for (let j = i - 1; j >= 0; j--) { const s = store.get(p.content![j]); if (s?.alive) return s; } }
export function nextSibling(b: Block) { const p = store.get(b.parent); if (!p) return; const c = p.content || []; const i = c.indexOf(b.id); for (let j = i + 1; j < c.length; j++) { const s = store.get(c[j]); if (s?.alive) return s; } }

function emptyText(parent: string, type: BlockType = 'text', extra: Partial<Block> = {}): Block {
  return { id: newId(), type, title: [], parent, parentTable: 'block', content: [], alive: true, created: Date.now(), edited: Date.now(), ...extra };
}

/** Insert a new block after `id` (or as first child when the block shows children). Returns new id. */
export function insertAfter(id: string, type: BlockType = 'text', opts: { title?: RichText; props?: Block['props']; format?: Block['format']; focus?: boolean; asSibling?: boolean } = {}): string {
  const b = store.get(id)!;
  const nb = emptyText(b.parent, type, { title: opts.title || [], props: opts.props, format: opts.format });
  store.transact('insert', (tx) => {
    tx.create(nb);
    tx.insertChild(b.parent, nb.id, indexInParent(b) + 1);
  }, { selAfter: { kind: 'text', blockId: nb.id, start: 0, end: 0 } });
  if (opts.focus !== false) focusBlock(nb.id, 0);
  return nb.id;
}

/** Enter key. */
export function splitBlock(id: string, start: number, end: number) {
  const b = store.get(id)!;
  const title = b.title || [];
  const len = rtLength(title);
  // empty list-ish → convert / outdent
  if (len === 0 && (isListish(b) || b.type === 'quote' || HEADINGS.includes(b.type)) && start === 0) {
    const parent = store.get(b.parent);
    if (isListish(b) && parent && isListish(parent)) { outdent([id]); return; }
    turnInto([id], 'text');
    focusBlock(id, 0);
    return;
  }
  const before = slice(title, 0, start), after = slice(title, end);
  const expandedWithKids = (b.content?.length && !isCollapsed(b) && canHaveChildren(b) && b.type !== 'page') || false;
  let newType: BlockType = isListish(b) ? b.type : 'text';
  if (b.type === 'toggle' && expandedWithKids) newType = 'text';
  const nb = emptyText(b.parent, newType, { title: after, props: b.type === 'to_do' ? { checked: false } : b.type === 'toggle' ? { expanded: false } : undefined });
  // splitting at offset 0 of a non-empty block: insert empty block above, keep current
  if (start === 0 && end === 0 && len > 0) {
    const above = emptyText(b.parent, isListish(b) ? b.type : 'text', { title: [] });
    store.transact('split', (tx) => { tx.create(above); tx.insertChild(b.parent, above.id, indexInParent(b)); }, { selAfter: { kind: 'text', blockId: id, start: 0, end: 0 } });
    focusBlock(id, 0);
    return;
  }
  store.transact('split', (tx) => {
    tx.update(id, { title: before });
    if (b.type === 'callout') { nb.parent = id; tx.create(nb); tx.insertChild(id, nb.id, 0); return; }
    if (expandedWithKids) { nb.parent = id; tx.create(nb); tx.insertChild(id, nb.id, 0); return; }
    tx.create(nb);
    tx.insertChild(b.parent, nb.id, indexInParent(b) + 1);
  }, { selAfter: { kind: 'text', blockId: nb.id, start: 0, end: 0 } });
  focusBlock(nb.id, 0);
}

/** Backspace at offset 0 with a collapsed selection. Returns true if handled. */
export function backspaceAtStart(id: string): boolean {
  const b = store.get(id)!;
  const parent = store.get(b.parent);
  if (b.type !== 'text' && b.type !== 'code') {
    turnInto([id], 'text');
    focusBlock(id, 0);
    return true;
  }
  // nested text under a list-ish / quote / toggle → outdent
  if (parent && parent.type !== 'page' && parent.type !== 'column' && parent.type !== 'callout' && parent.type !== 'synced' && !prevSibling(b)) { outdent([id]); focusBlock(id, 0); return true; }
  const page = pageIdOf(id);
  const order = visibleBlocks(page);
  const idx = order.findIndex((x) => x.id === id);
  let prev: Block | undefined;
  for (let i = idx - 1; i >= 0; i--) { const c = order[i]; if (c.type === 'column' || c.type === 'column_list') continue; prev = c; break; }
  if (!prev) {
    if (rtLength(b.title) === 0 && order.length > 1) { deleteBlocks([id]); focusTitle(); return true; }
    focusTitle(); return true;
  }
  if (NON_TEXT.includes(prev.type)) {
    if (rtLength(b.title) === 0 && !b.content?.length) { deleteBlocks([id]); }
    setBlockSelection([prev.id]);
    return true;
  }
  mergeInto(prev.id, id);
  return true;
}

/** Append `src` text into `dst`, move src's children after, delete src. */
export function mergeInto(dstId: string, srcId: string) {
  const dst = store.get(dstId)!, src = store.get(srcId)!;
  const at = rtLength(dst.title);
  store.transact('merge', (tx) => {
    tx.update(dstId, { title: concat(dst.title || [], src.title || []) });
    const kids = (src.content || []).filter((c) => store.get(c)?.alive);
    if (kids.length) {
      if (canHaveChildren(dst) && dst.type !== 'code') kids.forEach((k) => tx.insertChild(dstId, k));
      else { const p = store.get(src.parent)!; let i = (p.content || []).indexOf(srcId); kids.forEach((k) => tx.insertChild(src.parent, k, ++i)); }
      tx.update(srcId, { content: [] });
    }
    tx.removeChild(src.parent, srcId);
    tx.update(srcId, { alive: false });
  }, { selAfter: { kind: 'text', blockId: dstId, start: at, end: at } });
  focusBlock(dstId, at);
}

export function deleteForwardAtEnd(id: string) {
  const page = pageIdOf(id);
  const order = focusableBlocks(page);
  const i = order.findIndex((x) => x.id === id);
  const next = order[i + 1];
  if (next) mergeInto(id, next.id);
}

export function focusTitle() {
  const t = document.querySelector<HTMLElement>('.ink-page-title [contenteditable]');
  if (t) { t.focus(); const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
}

/** Tab: nest blocks under their previous sibling. */
export function indent(ids: string[]) {
  const blocks = ids.map((i) => store.get(i)!).filter(Boolean);
  if (!blocks.length) return;
  const first = blocks[0];
  const prev = prevSibling(first);
  if (!prev || !canHaveChildren(prev) || prev.type === 'page' || prev.type === 'code') return;
  store.transact('indent', (tx) => {
    for (const b of blocks) {
      if (b.parent !== first.parent) continue;
      tx.removeChild(b.parent, b.id);
      tx.insertChild(prev.id, b.id);
    }
    if (isCollapsed(prev)) tx.update(prev.id, (p) => ({ props: { ...p.props, expanded: true } }));
  });
}
/** Shift+Tab: move blocks after their parent; following siblings become children of the last moved block. */
export function outdent(ids: string[]) {
  const blocks = ids.map((i) => store.get(i)!).filter(Boolean);
  if (!blocks.length) return;
  const parent = store.get(blocks[0].parent);
  if (!parent || parent.type === 'page' || parent.type === 'collection_view_page' || parent.type === 'column') return;
  const grand = store.get(parent.parent); if (!grand) return;
  store.transact('outdent', (tx) => {
    const siblings = (store.get(parent.id)!.content || []);
    const lastIdx = siblings.indexOf(blocks[blocks.length - 1].id);
    const following = siblings.slice(lastIdx + 1).filter((c) => store.get(c)?.alive && !ids.includes(c));
    let at = (store.get(grand.id)!.content || []).indexOf(parent.id) + 1;
    for (const b of blocks) { if (b.parent !== parent.id) continue; tx.removeChild(parent.id, b.id); tx.insertChild(grand.id, b.id, at++); }
    const last = blocks[blocks.length - 1];
    if (following.length && canHaveChildren(last)) for (const f of following) { tx.removeChild(parent.id, f); tx.insertChild(last.id, f); }
  });
}

/** Turn blocks into another type, keeping text and children. */
export function turnInto(ids: string[], type: BlockType, opts: { toggleable?: boolean } = {}) {
  store.transact('turn into', (tx) => {
    for (const id of ids) {
      const b = store.get(id); if (!b) continue;
      const format = { ...b.format };
      if (opts.toggleable) format.toggleable = true; else delete format.toggleable;
      const props = { ...b.props };
      if (type === 'to_do' && props.checked === undefined) props.checked = false;
      if ((type === 'toggle' || opts.toggleable) && props.expanded === undefined) props.expanded = true;
      if (type === 'callout' && !format.page_icon) format.page_icon = '💡';
      if (type === 'code' && !props.language) props.language = 'plain';
      let title = b.title;
      if (type === 'code' && title) title = [[title.map((s) => s[0]).join('')]];
      tx.update(id, { type, format, props, title });
      if (type === 'page') {
        // the text becomes the page title; ensure it has one empty paragraph
        const tid = newId();
        tx.create({ id: tid, type: 'text', title: [], parent: id, parentTable: 'block', content: [] });
        tx.update(id, (cur) => ({ content: [...(cur.content || []), tid] }));
      }
    }
  });
}

export function setBlocksColor(ids: string[], color: string | undefined) {
  store.transact('color', (tx) => { for (const id of ids) tx.update(id, (b) => ({ format: { ...b.format, color: color && color !== 'default' ? color : undefined } })); });
}

export function deleteBlocks(ids: string[]) {
  if (!ids.length) return;
  store.transact('delete', (tx) => {
    for (const id of ids) { const b = store.get(id); if (!b) continue; tx.removeChild(b.parent, id); tx.update(id, { alive: false }); }
    // remove empty columns / column lists
    for (const id of ids) {
      const b = store.get(id); const col = b && store.get(b.parent);
      if (col?.type === 'column' && !(col.content || []).some((c) => store.get(c)?.alive)) {
        const list = store.get(col.parent)!; tx.removeChild(list.id, col.id); tx.update(col.id, { alive: false });
        const rest = (store.get(list.id)!.content || []).filter((c) => store.get(c)?.alive);
        if (rest.length === 1) { // unwrap single column
          const only = store.get(rest[0])!; const lp = store.get(list.parent)!; let at = (lp.content || []).indexOf(list.id);
          for (const k of (only.content || [])) { tx.insertChild(lp.id, k, ++at); }
          tx.removeChild(lp.id, list.id); tx.update(list.id, { alive: false });
        }
      }
    }
  });
}

export function duplicateBlocks(ids: string[]): string[] {
  const out: string[] = [];
  const clone = (tx: any, id: string, parent: string): string => {
    const src = store.get(id)!; const nid = newId();
    const kids = (src.content || []).filter((c) => store.get(c)?.alive).map((c) => clone(tx, c, nid));
    tx.create({ ...structuredClone(src), id: nid, parent, parentTable: 'block', content: kids });
    return nid;
  };
  store.transact('duplicate', (tx) => {
    const sorted = [...ids];
    let lastId = sorted[sorted.length - 1];
    for (const id of sorted) {
      const b = store.get(id); if (!b) continue;
      const nid = clone(tx, id, b.parent);
      const anchor = store.get(lastId)!;
      tx.insertChild(b.parent, nid, (store.get(b.parent)!.content || []).indexOf(anchor.parent === b.parent ? lastId : id) + 1);
      lastId = nid; out.push(nid);
    }
  });
  return out;
}

/** Move blocks relative to a target: before/after it, or into a new column next to it. */
export function moveBlocks(ids: string[], targetId: string, edge: 'top' | 'bottom' | 'left' | 'right' | 'inside') {
  if (ids.includes(targetId)) return;
  const target = store.get(targetId); if (!target) return;
  for (const id of ids) if (store.ancestors(targetId).some((a) => a.id === id)) return;
  store.transact('move', (tx) => {
    if (edge === 'left' || edge === 'right') {
      const tp = store.get(target.parent)!;
      if (tp.type === 'column') {
        // add a new column to the existing list
        const list = store.get(tp.parent)!;
        const col = emptyText(list.id, 'column', { format: { column_ratio: 1 } });
        tx.create(col);
        const ci = (list.content || []).indexOf(tp.id);
        tx.insertChild(list.id, col.id, edge === 'left' ? ci : ci + 1);
        for (const id of ids) { const b = store.get(id)!; tx.removeChild(b.parent, id); tx.insertChild(col.id, id); }
        const cols = (store.get(list.id)!.content || []).filter((c) => store.get(c)?.alive);
        cols.forEach((c) => tx.update(c, (cb) => ({ format: { ...cb.format, column_ratio: 1 / cols.length } })));
      } else {
        const list = emptyText(target.parent, 'column_list');
        const c1 = emptyText(list.id, 'column', { format: { column_ratio: 0.5 } });
        const c2 = emptyText(list.id, 'column', { format: { column_ratio: 0.5 } });
        tx.create(list); tx.create(c1); tx.create(c2);
        const at = (tp.content || []).indexOf(targetId);
        tx.insertChild(tp.id, list.id, at);
        tx.removeChild(tp.id, targetId);
        const [a, bcol] = edge === 'left' ? [c1, c2] : [c2, c1];
        tx.insertChild(bcol.id, targetId);
        for (const id of ids) { const b = store.get(id)!; tx.removeChild(b.parent, id); tx.insertChild(a.id, id); }
        tx.update(list.id, { content: [c1.id, c2.id] });
      }
    } else if (edge === 'inside') {
      for (const id of ids) { const b = store.get(id)!; tx.removeChild(b.parent, id); tx.insertChild(targetId, id); }
    } else {
      for (const id of ids) { const b = store.get(id)!; tx.removeChild(b.parent, id); }
      const tp = store.get(target.parent)!;
      let at = (store.get(tp.id)!.content || []).indexOf(targetId) + (edge === 'bottom' ? 1 : 0);
      for (const id of ids) tx.insertChild(tp.id, id, at++);
    }
    // cleanup empty columns
    for (const b of store.blocks.values()) {
      if (b.type === 'column' && b.alive && !(b.content || []).some((c) => store.get(c)?.alive)) {
        const list = store.get(b.parent); if (!list) continue;
        tx.removeChild(list.id, b.id); tx.update(b.id, { alive: false });
        const rest = (store.get(list.id)!.content || []).filter((c) => store.get(c)?.alive);
        if (rest.length === 1) {
          const only = store.get(rest[0])!; const lp = store.get(list.parent)!; let at = (lp.content || []).indexOf(list.id);
          for (const k of (only.content || [])) tx.insertChild(lp.id, k, ++at);
          tx.removeChild(lp.id, list.id); tx.update(list.id, { alive: false });
        } else rest.forEach((c) => tx.update(c, (cb) => ({ format: { ...cb.format, column_ratio: 1 / rest.length } })));
      }
    }
  });
}

/** Insert columns layout after a block (slash "2 columns"). */
export function insertColumns(afterId: string, n: number, replace: boolean) {
  const b = store.get(afterId)!;
  const list = emptyText(b.parent, 'column_list');
  const cols = Array.from({ length: n }, () => emptyText(list.id, 'column', { format: { column_ratio: 1 / n } }));
  const texts = cols.map((c) => emptyText(c.id, 'text'));
  store.transact('columns', (tx) => {
    tx.create({ ...list, content: cols.map((c) => c.id) });
    cols.forEach((c, i) => { tx.create({ ...c, content: [texts[i].id] }); tx.create(texts[i]); });
    tx.insertChild(b.parent, list.id, indexInParent(b) + (replace ? 0 : 1));
    if (replace) { tx.removeChild(b.parent, afterId); tx.update(afterId, { alive: false }); }
  });
  focusBlock(texts[0].id, 0);
}

export function setTitle(id: string, title: RichText, coalesce = true, sel?: { start: number; end: number }) {
  store.transact('type', (tx) => tx.update(id, { title }), { coalesce: coalesce ? 'type:' + id : undefined, selAfter: sel ? { kind: 'text', blockId: id, ...sel } : undefined });
}
