import type React from 'react';
import { store } from '../store/store';
import { getSelectionOffsets, setSelectionOffsets, caretOnEdgeLine, placeCaretAtX, caretRect, textLength } from './caret';
import { splitBlock, backspaceAtStart, deleteForwardAtEnd, indent, outdent, pageIdOf, turnInto, duplicateBlocks, insertAfter, prevSibling, nextSibling, moveBlocks, setTitle } from './commands';
import { focusBlock, focusableBlocks, setBlockSelection, restoreSelection, selectableBlocks } from './registry';
import { toggleMark, rangeHasMark, setColor, slice, rtLength } from './richtext';
import { inlineMenuKey, isInlineMenuOpen } from './inline-menus';
import { openLinkPopover } from './link-popover';
import { lastUsedColor } from './colors';
import { openBlockMenuFor } from './block-menu';
import type { BlockType } from '../store/model';

const isMac = () => true; // the product targets macOS shortcuts; Ctrl is accepted too
export const mod = (e: KeyboardEvent | React.KeyboardEvent) => e.metaKey || e.ctrlKey;

export function undo() { const s = store.undo(); restoreSelection(s ?? undefined); }
export function redo() { const s = store.redo(); restoreSelection(s ?? undefined); }

const TURN_KEYS: Record<string, BlockType | 'toggleH'> = { '0': 'text', '1': 'header', '2': 'sub_header', '3': 'sub_sub_header', '4': 'to_do', '5': 'bulleted_list', '6': 'numbered_list', '7': 'toggle', '8': 'code', '9': 'page' };

export function handleKeyDown(e: React.KeyboardEvent<HTMLElement>, id: string, el: HTMLElement, opts: { code: boolean; cell: boolean }) {
  if (isInlineMenuOpen() && inlineMenuKey(e.nativeEvent)) { e.preventDefault(); return; }
  const b = store.get(id); if (!b) return;
  const sel = getSelectionOffsets(el) || { start: 0, end: 0, backward: false };
  const collapsed = sel.start === sel.end;
  const len = textLength(el);
  const k = e.key;

  // ---- formatting & editing shortcuts
  if (mod(e) && !e.altKey) {
    const lk = k.toLowerCase();
    if (lk === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (lk === 'y') { e.preventDefault(); redo(); return; }
    if (!opts.code && !collapsed && ['b', 'i', 'u', 'e'].includes(lk) && !e.shiftKey) {
      e.preventDefault();
      const key = lk === 'e' ? 'code' : (lk as 'b' | 'i' | 'u');
      setTitle(id, toggleMark(b.title || [], sel.start, sel.end, key), false, sel);
      restoreAfterRender(id, sel.start, sel.end);
      return;
    }
    if (!opts.code && !collapsed && e.shiftKey && (lk === 's' || lk === 'x')) { e.preventDefault(); setTitle(id, toggleMark(b.title || [], sel.start, sel.end, 's'), false, sel); restoreAfterRender(id, sel.start, sel.end); return; }
    if (!opts.code && !collapsed && e.shiftKey && lk === 'h') { e.preventDefault(); setTitle(id, setColor(b.title || [], sel.start, sel.end, lastUsedColor()), false, sel); restoreAfterRender(id, sel.start, sel.end); return; }
    if (lk === 'k' && !opts.code) { e.preventDefault(); if (!collapsed) openLinkPopover(id, sel.start, sel.end); return; }
    if (lk === 'd' && !opts.cell) { e.preventDefault(); const [n] = duplicateBlocks([id]); if (n) focusBlock(n, 'end'); return; }
    if (lk === 'a' && !opts.cell) {
      if (len === 0 || (sel.start === 0 && sel.end === len)) { e.preventDefault(); setBlockSelection(store.children(pageIdOf(id)).filter((x) => x.alive).map((x) => x.id)); }
      return;
    }
    if (k === 'Enter' && !opts.cell) {
      e.preventDefault();
      if (b.type === 'to_do') store.transact('check', (tx) => tx.update(id, (x) => ({ props: { ...x.props, checked: !x.props?.checked } })));
      else if (b.type === 'toggle' || b.format?.toggleable) store.transact('toggle', (tx) => tx.update(id, (x) => ({ props: { ...x.props, expanded: !x.props?.expanded } })), { noUndo: true });
      else if (opts.code) insertAfter(id, 'text');
      return;
    }
    if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown') && !opts.cell) {
      e.preventDefault();
      const sib = k === 'ArrowUp' ? prevSibling(b) : nextSibling(b);
      if (sib) { moveBlocks([id], sib.id, k === 'ArrowUp' ? 'top' : 'bottom'); focusBlock(id, sel.start); }
      return;
    }
    if (k === '/' && !opts.cell) { e.preventDefault(); openBlockMenuFor([id], el); return; }
  }
  if (mod(e) && e.altKey && TURN_KEYS[e.code?.replace('Digit', '')] && !opts.cell) {
    e.preventDefault();
    const tt = TURN_KEYS[e.code.replace('Digit', '')] as BlockType;
    turnInto([id], tt); focusBlock(id, sel.start); return;
  }

  // ---- structural keys
  if (k === 'Enter' && !e.shiftKey) {
    if (opts.cell) { e.preventDefault(); return; }
    e.preventDefault();
    if (opts.code) { document.execCommand('insertText', false, '\n'); return; }
    splitBlock(id, sel.start, sel.end);
    return;
  }
  if (k === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
  if (k === 'Backspace' && collapsed && sel.start === 0 && !opts.cell) {
    if (opts.code && len > 0) return;
    e.preventDefault(); backspaceAtStart(id); return;
  }
  if (k === 'Delete' && collapsed && sel.start === len && !opts.cell) { e.preventDefault(); deleteForwardAtEnd(id); return; }
  if (k === 'Tab' && !opts.cell) {
    e.preventDefault();
    if (opts.code) { if (!e.shiftKey) document.execCommand('insertText', false, '  '); return; }
    const off = sel.start;
    e.shiftKey ? outdent([id]) : indent([id]);
    focusBlock(id, off);
    return;
  }
  if (k === 'Escape') {
    e.preventDefault();
    (el as HTMLElement).blur();
    setBlockSelection([id]);
    return;
  }
  if (opts.cell) return;
  const page = pageIdOf(id);
  if ((k === 'ArrowUp' || k === 'ArrowDown') && !e.shiftKey && !e.altKey && !mod(e)) {
    const edge = k === 'ArrowUp' ? 'top' : 'bottom';
    if (!caretOnEdgeLine(el, edge)) return;
    const order = focusableBlocks(page);
    const i = order.findIndex((x) => x.id === id);
    const target = order[i + (k === 'ArrowUp' ? -1 : 1)];
    if (!target) {
      if (k === 'ArrowUp') { e.preventDefault(); const t = document.querySelector<HTMLElement>('.ink-page-title [contenteditable]'); if (t) { t.focus(); placeCaretAtX(t, caretRect()?.left ?? 0, 'bottom'); } }
      return;
    }
    e.preventDefault();
    const x = caretRect()?.left ?? el.getBoundingClientRect().left;
    focusBlock(target.id, 0);
    requestAnimationFrame(() => { const tel = document.querySelector<HTMLElement>(`[data-editable-id="${target.id}"]`); if (tel) placeCaretAtX(tel, x, k === 'ArrowUp' ? 'bottom' : 'top'); });
    return;
  }
  if (k === 'ArrowUp' && e.shiftKey && collapsed && sel.start === 0 || k === 'ArrowDown' && e.shiftKey && collapsed && sel.end === len) {
    e.preventDefault(); el.blur(); setBlockSelection([id]); return;
  }
  if (k === 'ArrowLeft' && collapsed && sel.start === 0 && !e.shiftKey) {
    const order = focusableBlocks(page); const i = order.findIndex((x) => x.id === id);
    if (order[i - 1]) { e.preventDefault(); focusBlock(order[i - 1].id, 'end'); }
    return;
  }
  if (k === 'ArrowRight' && collapsed && sel.end === len && !e.shiftKey) {
    const order = focusableBlocks(page); const i = order.findIndex((x) => x.id === id);
    if (order[i + 1]) { e.preventDefault(); focusBlock(order[i + 1].id, 0); }
    return;
  }
  // typing over a selection that spans formatting → let browser handle
  void rangeHasMark; void selectableBlocks; void slice; void rtLength; void setSelectionOffsets; void isMac;
}

export function restoreAfterRender(id: string, start: number, end: number) {
  requestAnimationFrame(() => focusBlock(id, start, end));
}
