/** Editor runtime state: mounted editables, focus requests, block selection. */
import { store, type SelectionSnapshot } from '../store/store';
import type { Block } from '../store/model';
import { getSelectionOffsets, setSelectionOffsets, textLength } from './caret';

export const editables = new Map<string, HTMLElement>();
const pendingFocus = new Map<string, { start: number | 'end'; end?: number | 'end' }>();

export function registerEditable(id: string, el: HTMLElement | null) {
  if (el) {
    editables.set(id, el);
    const p = pendingFocus.get(id);
    if (p) { pendingFocus.delete(id); requestAnimationFrame(() => applyFocus(id, p.start, p.end)); }
  } else editables.delete(id);
}

function applyFocus(id: string, start: number | 'end', end?: number | 'end') {
  const el = editables.get(id); if (!el) return false;
  el.focus({ preventScroll: true });
  const len = textLength(el);
  const s = start === 'end' ? len : Math.min(start, len);
  const e = end === undefined ? s : end === 'end' ? len : Math.min(end, len);
  setSelectionOffsets(el, s, e);
  scrollIntoViewIfNeeded(el);
  return true;
}
export function scrollIntoViewIfNeeded(el: HTMLElement) {
  const scroller = el.closest('.ink-scroller'); if (!scroller) return;
  const r = el.getBoundingClientRect(), s = scroller.getBoundingClientRect();
  if (r.bottom > s.bottom - 40) scroller.scrollTop += r.bottom - s.bottom + 80;
  else if (r.top < s.top + 40) scroller.scrollTop -= s.top + 40 - r.top + 20;
}

/** Focus a block's editable at an offset. Works even if the block mounts on the next frame. */
export function focusBlock(id: string, start: number | 'end' = 'end', end?: number | 'end') {
  clearBlockSelection();
  if (editables.has(id)) { if (!applyFocus(id, start, end)) pendingFocus.set(id, { start, end }); }
  else pendingFocus.set(id, { start, end });
  // retry once after React commit
  requestAnimationFrame(() => { if (pendingFocus.has(id) && editables.has(id)) { const p = pendingFocus.get(id)!; pendingFocus.delete(id); applyFocus(id, p.start, p.end); } });
}

/** The block whose editable currently has the DOM selection. */
export function activeEditable(): { id: string; el: HTMLElement } | null {
  const sel = window.getSelection();
  const n = sel?.anchorNode; if (!n) return null;
  const el = (n instanceof HTMLElement ? n : n.parentElement)?.closest<HTMLElement>('[data-editable-id]');
  if (!el) return null;
  return { id: el.dataset.editableId!, el };
}

/* ---------- block selection ---------- */
let selected: string[] = [];
let selAnchor: string | null = null;
const selSubs = new Set<() => void>();
export function getBlockSelection() { return selected; }
export function onBlockSelection(f: () => void) { selSubs.add(f); return () => { selSubs.delete(f); }; }
export function setBlockSelection(ids: string[], anchor?: string) {
  selected = ids; selAnchor = anchor ?? ids[0] ?? null;
  selSubs.forEach((f) => f());
  if (ids.length) {
    // park focus on the page so keyboard shortcuts work
    const host = document.querySelector<HTMLElement>('.ink-page-keyhost');
    if (host && document.activeElement !== host) { window.getSelection()?.removeAllRanges(); host.focus({ preventScroll: true }); }
  }
}
export function clearBlockSelection() { if (selected.length) setBlockSelection([]); }
export function getSelAnchor() { return selAnchor; }

/** Snapshot used by undo/redo. */
store.captureSelection = (): SelectionSnapshot => {
  if (selected.length) return { kind: 'blocks', ids: [...selected] };
  const a = activeEditable(); if (!a) return null;
  const o = getSelectionOffsets(a.el); if (!o) return null;
  return { kind: 'text', blockId: a.id, start: o.start, end: o.end };
};
export function restoreSelection(s: SelectionSnapshot | undefined) {
  if (!s) return;
  if (s.kind === 'blocks') setBlockSelection(s.ids.filter((id) => store.get(id)?.alive));
  else if (store.get(s.blockId)?.alive) focusBlock(s.blockId, s.start, s.end);
}

/* ---------- document order ---------- */
export const NON_TEXT: Block['type'][] = ['divider', 'image', 'bookmark', 'video', 'equation', 'table', 'table_of_contents', 'breadcrumb', 'alias', 'page', 'collection_view_page', 'column_list', 'column', 'synced', 'table_row'];
export function isCollapsed(b: Block) {
  return (b.type === 'toggle' || (b.format?.toggleable && ['header', 'sub_header', 'sub_sub_header', 'header_4'].includes(b.type))) && !b.props?.expanded;
}
/** All visible blocks under a page in document order (depth-first), excluding the page itself. */
export function visibleBlocks(pageId: string): Block[] {
  const out: Block[] = [];
  const walk = (id: string) => {
    for (const c of store.children(id)) {
      out.push(c);
      if (c.type === 'page' || c.type === 'collection_view_page' || c.type === 'table') continue;
      if (!isCollapsed(c)) walk(c.id);
    }
  };
  walk(pageId);
  return out;
}
/** Visible "selectable" blocks (top-level units for selection: excludes columns/column lists). */
export function selectableBlocks(pageId: string): Block[] {
  return visibleBlocks(pageId).filter((b) => b.type !== 'column' && b.type !== 'column_list' && b.type !== 'table_row');
}
export function focusableBlocks(pageId: string): Block[] {
  return visibleBlocks(pageId).filter((b) => !NON_TEXT.includes(b.type) || b.type === 'synced' && false);
}
