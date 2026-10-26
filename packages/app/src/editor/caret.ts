/** Map between plain-text offsets and DOM positions inside one editable element. */

function isToken(n: Node): n is HTMLElement { return n instanceof HTMLElement && !!n.dataset.token; }
function isPlaceholder(n: Node) { return n instanceof HTMLElement && n.dataset.placeholder !== undefined; }

/** length of a node in model characters */
function nodeLen(n: Node): number {
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/\u200b/g, '').length;
  if (isToken(n)) return 1;
  if (isPlaceholder(n)) return 0;
  if (n instanceof HTMLElement && n.tagName === 'BR') return n.nextSibling ? 1 : 0;
  let s = 0; n.childNodes.forEach((c) => (s += nodeLen(c))); return s;
}

/** Offset of DOM point (node, off) relative to root. */
export function domToOffset(root: HTMLElement, node: Node, off: number): number {
  if (!root.contains(node)) return 0;
  let total = 0;
  const walk = (n: Node): boolean => {
    if (n === node) {
      if (n.nodeType === Node.TEXT_NODE) { total += (n.textContent || '').slice(0, off).replace(/\u200b/g, '').length; }
      else { for (let i = 0; i < off && i < n.childNodes.length; i++) total += nodeLen(n.childNodes[i]); }
      return true;
    }
    if (n.nodeType === Node.TEXT_NODE || isToken(n) || (n instanceof HTMLElement && n.tagName === 'BR')) {
      if (isToken(n) && n.contains(node)) { total += 1; return true; }
      total += nodeLen(n); return false;
    }
    for (const c of Array.from(n.childNodes)) if (walk(c)) return true;
    return false;
  };
  for (const c of Array.from(root.childNodes)) if (walk(c)) break;
  return total;
}

/** DOM point for a model offset. */
export function offsetToDom(root: HTMLElement, offset: number): { node: Node; offset: number } {
  let remaining = offset;
  const walk = (n: Node): { node: Node; offset: number } | null => {
    if (n.nodeType === Node.TEXT_NODE) {
      const raw = n.textContent || '';
      const len = raw.replace(/\u200b/g, '').length;
      if (remaining <= len) {
        // map model offset → raw offset skipping zero-width spaces
        let i = 0, k = 0;
        while (k < remaining && i < raw.length) { if (raw[i] !== '\u200b') k++; i++; }
        return { node: n, offset: i };
      }
      remaining -= len; return null;
    }
    if (isToken(n) || (n instanceof HTMLElement && n.tagName === 'BR')) {
      const len = nodeLen(n);
      const parent = n.parentNode!;
      const idx = Array.prototype.indexOf.call(parent.childNodes, n);
      if (remaining === 0) return { node: parent, offset: idx };
      if (remaining <= len) return { node: parent, offset: idx + 1 };
      remaining -= len; return null;
    }
    if (isPlaceholder(n)) return null;
    for (const c of Array.from(n.childNodes)) { const r = walk(c); if (r) return r; }
    return null;
  };
  for (const c of Array.from(root.childNodes)) { const r = walk(c); if (r) return r; }
  return { node: root, offset: root.childNodes.length };
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number; backward: boolean } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
  const a = domToOffset(root, sel.anchorNode!, sel.anchorOffset);
  const f = domToOffset(root, sel.focusNode!, sel.focusOffset);
  return { start: Math.min(a, f), end: Math.max(a, f), backward: f < a };
}

export function setSelectionOffsets(root: HTMLElement, start: number, end = start) {
  const sel = window.getSelection(); if (!sel) return;
  const a = offsetToDom(root, start);
  const b = end === start ? a : offsetToDom(root, end);
  const r = document.createRange();
  try { r.setStart(a.node, a.offset); r.setEnd(b.node, b.offset); } catch { r.selectNodeContents(root); r.collapse(false); }
  sel.removeAllRanges(); sel.addRange(r);
}

/** caret rectangle (for positioning popovers) */
export function caretRect(): DOMRect | null {
  const sel = window.getSelection(); if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0).cloneRange();
  let rect = r.getClientRects()[0] || r.getBoundingClientRect();
  if ((!rect || (rect.width === 0 && rect.height === 0 && rect.x === 0)) && sel.anchorNode) {
    const el = (sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement)!;
    const span = document.createElement('span'); span.textContent = '\u200b';
    r.insertNode(span); rect = span.getBoundingClientRect(); span.remove();
    el.normalize();
  }
  return rect || null;
}

/** Is the caret on the first / last visual line of the element? */
export function caretOnEdgeLine(root: HTMLElement, edge: 'top' | 'bottom'): boolean {
  const sel = window.getSelection(); if (!sel || !sel.rangeCount) return true;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  const cr = rects[0] || caretRect();
  if (!cr || (cr.height === 0 && cr.top === 0)) return true;
  const box = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  const lh = parseFloat(cs.lineHeight) || 24;
  if (edge === 'top') return cr.top - box.top - parseFloat(cs.paddingTop) < lh * 0.75;
  return box.bottom - parseFloat(cs.paddingBottom) - cr.bottom < lh * 0.75;
}

/** Place caret in root at the x coordinate on the first/last line. */
export function placeCaretAtX(root: HTMLElement, x: number, edge: 'top' | 'bottom') {
  const box = root.getBoundingClientRect();
  const cs = getComputedStyle(root);
  const y = edge === 'top' ? box.top + parseFloat(cs.paddingTop) + 4 : box.bottom - parseFloat(cs.paddingBottom) - 4;
  const doc = document as any;
  let pos: { node: Node; offset: number } | null = null;
  if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p && root.contains(p.offsetNode)) pos = { node: p.offsetNode, offset: p.offset }; }
  else if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(x, y); if (r && root.contains(r.startContainer)) pos = { node: r.startContainer, offset: r.startOffset }; }
  if (pos) { const off = domToOffset(root, pos.node, pos.offset); setSelectionOffsets(root, off); }
  else setSelectionOffsets(root, edge === 'top' ? 0 : nodeLen(root));
}
export const textLength = (root: HTMLElement) => { let s = 0; root.childNodes.forEach((c) => (s += nodeLen(c))); return s; }; // root may carry data-placeholder
