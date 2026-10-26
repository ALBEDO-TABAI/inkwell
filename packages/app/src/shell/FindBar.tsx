/** Find in page (Cmd/Ctrl+F): a small bar at the top right, matches highlighted with the CSS Custom Highlight API. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '../ui/icons';
import { store } from '../store/store';

let open = false; const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function openFind() { open = true; emit(); setTimeout(() => { const el = document.querySelector<HTMLInputElement>('.ink-find input'); el?.focus(); el?.select(); }, 0); }
export function closeFind() { open = false; emit(); }
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => open);

type HL = { set: (k: string, v: unknown) => void; delete: (k: string) => void };
const highlights = (): HL | null => (typeof CSS !== 'undefined' && (CSS as unknown as { highlights?: HL }).highlights) || null;
const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

function collect(q: string): Range[] {
  const root = document.querySelector('.ink-peek .ink-page') || document.querySelector('.ink-main .ink-page');
  if (!root || !q) return [];
  const needle = q.toLowerCase(); const out: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => ((n.parentElement?.closest('.ink-block-handle, .ink-tv-gutter, .ink-db-measure, [aria-hidden="true"]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.nodeValue || '').toLowerCase();
    let i = text.indexOf(needle);
    while (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); out.push(r); i = text.indexOf(needle, i + needle.length); }
  }
  return out;
}

export function FindBar() {
  const isOpen = useOpen();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [ranges, setRanges] = useState<Range[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) { highlights()?.delete('ink-find'); highlights()?.delete('ink-find-current'); return; }
    const run = () => { const rs = collect(q); setRanges(rs); setIdx((i) => (rs.length ? Math.min(i, rs.length - 1) : 0)); };
    run();
    const unsub = store.subscribe(() => requestAnimationFrame(run));
    return () => { unsub(); };
  }, [isOpen, q]);
  useEffect(() => {
    const h = highlights(); if (!h || !HighlightCtor) return;
    if (!isOpen || !ranges.length) { h.delete('ink-find'); h.delete('ink-find-current'); return; }
    h.set('ink-find', new HighlightCtor(...ranges));
    const cur = ranges[idx]; if (cur) { h.set('ink-find-current', new HighlightCtor(cur)); const r = cur.getBoundingClientRect(); const sc = (cur.startContainer.parentElement as HTMLElement)?.closest('.ink-scroller'); if (sc) { const b = sc.getBoundingClientRect(); if (r.top < b.top + 60 || r.bottom > b.bottom - 40) sc.scrollTop += r.top - b.top - b.height / 3; } }
  }, [ranges, idx, isOpen]);
  if (!isOpen) return null;
  const n = ranges.length;
  const step = (d: number) => n && setIdx((i) => (i + d + n) % n);
  return (
    <div className="ink-find" role="search">
      <Icon name="search" size={14} />
      <input ref={inputRef} value={q} placeholder="在页面中查找" onChange={(e) => { setQ(e.target.value); setIdx(0); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); } }} />
      <span className="ink-find-count">{q ? (n ? `${idx + 1}/${n}` : '0/0') : ''}</span>
      <button aria-label="上一个" onClick={() => step(-1)} disabled={!n}><Icon name="chevronUp" size={16} /></button>
      <button aria-label="下一个" onClick={() => step(1)} disabled={!n}><Icon name="chevronDown" size={16} /></button>
      <button aria-label="关闭" onClick={closeFind}><Icon name="x" size={16} /></button>
    </div>
  );
}
