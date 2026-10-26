import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type Anchor = DOMRect | { left: number; top: number; right: number; bottom: number; width?: number; height?: number };
export type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'right-start' | 'left-start' | 'left-center' | 'top' | 'center';

export interface PopoverSpec {
  id?: string;
  anchor: Anchor | (() => Anchor);
  placement?: Placement;
  offset?: number;
  render: (close: () => void) => ReactNode;
  onClose?: () => void;
  /** dim background, e.g. settings modal */
  modal?: boolean;
  /** close when clicking outside (default true) */
  dismissOnOutside?: boolean;
  /** keep focus where it is (inline menus while typing) */
  noFocus?: boolean;
  className?: string;
  /** for placement 'center': place the top edge at this fraction of the viewport height when it fits */
  topFraction?: number;
  style?: CSSProperties;
  /** parent popover id — children close with parent and outside-clicks inside children don't close parent */
  parent?: string;
  zIndex?: number;
}

interface Entry extends PopoverSpec { id: string }
let stack: Entry[] = [];
const subs = new Set<() => void>();
const emit = () => { stack = [...stack]; subs.forEach((f) => f()); };
let seq = 0;

export function openPopover(spec: PopoverSpec): string {
  const id = spec.id || `pop-${++seq}`;
  closePopover(id, true);
  stack.push({ ...spec, id });
  emit();
  return id;
}
export function closePopover(id: string, silent = false) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const removed = stack.filter((e, i) => i >= idx && (i === idx || isDescendant(e, id)));
  stack = stack.filter((e) => !removed.includes(e));
  if (!silent) removed.reverse().forEach((e) => e.onClose?.());
  emit();
}
function isDescendant(e: Entry, id: string): boolean {
  let p = e.parent;
  while (p) { if (p === id) return true; p = stack.find((x) => x.id === p)?.parent; }
  return false;
}
export function closeAllPopovers() { [...stack].reverse().forEach((e) => closePopover(e.id)); }
export function isPopoverOpen(id?: string) { return id ? stack.some((e) => e.id === id) : stack.length > 0; }
export function topPopover() { return stack[stack.length - 1]; }
const getStack = () => stack;

export function OverlayHost() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getStack);
  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      if (!stack.length) return;
      const t = ev.target as HTMLElement;
      const inside = t.closest?.('[data-popover-id]')?.getAttribute('data-popover-id');
      // close every popover on top of the one clicked (or all if outside)
      for (let i = stack.length - 1; i >= 0; i--) {
        const e = stack[i];
        if (e.id === inside) break;
        if (inside && isDescendantId(inside, e.id)) break;
        if (e.dismissOnOutside === false) break;
        if (t.closest?.('[data-popover-anchor="' + e.id + '"]')) break;
        closePopover(e.id);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && stack.length && !ev.defaultPrevented) {
        const top = stack[stack.length - 1];
        ev.preventDefault(); ev.stopPropagation();
        closePopover(top.id);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, []);
  return createPortal(<>{s.map((e, i) => <PopoverFrame key={e.id} entry={e} z={(e.zIndex ?? 1000) + i} />)}</>, document.body);
}
function isDescendantId(child: string, ancestor: string) {
  let p = stack.find((x) => x.id === child)?.parent;
  while (p) { if (p === ancestor) return true; p = stack.find((x) => x.id === p)?.parent; }
  return false;
}

function PopoverFrame({ entry, z }: { entry: Entry; z: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const close = () => closePopover(entry.id);
  useLayoutEffect(() => {
    const el = ref.current!;
    const place = () => {
      const a = typeof entry.anchor === 'function' ? entry.anchor() : entry.anchor;
      const w = el.offsetWidth, h = el.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight, off = entry.offset ?? 0, m = 12;
      let left = a.left, top = a.bottom + off;
      switch (entry.placement || 'bottom-start') {
        case 'bottom-end': left = a.right - w; break;
        case 'bottom': left = (a.left + a.right) / 2 - w / 2; break;
        case 'top-start': top = a.top - h - off; break;
        case 'top': top = a.top - h - off; left = (a.left + a.right) / 2 - w / 2; break;
        case 'right-start': left = a.right + off; top = a.top; if (left + w > vw - m) left = a.left - w - off; break;
        case 'left-start': left = a.left - w - off; top = a.top; break;
        case 'left-center': left = a.left - w - off; top = (a.top + a.bottom) / 2 - h / 2; break;
        case 'center': left = (vw - w) / 2; top = (vh - h) / 2; if (entry.topFraction != null && vh * entry.topFraction + h <= vh - m) top = vh * entry.topFraction; break;
      }
      if (entry.placement !== 'center') {
        if (top + h > vh - m) {
          const above = a.top - h - off;
          top = above >= m && !(entry.placement || '').startsWith('right') ? above : Math.max(m, vh - m - h);
        }
        left = Math.max(m, Math.min(left, vw - m - w));
        top = Math.max(m, top);
      }
      setPos({ left, top });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener('resize', place);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); };
  }, [entry]);
  const focused = useRef<Entry | null>(null);
  useEffect(() => {
    // Hidden (unplaced) elements can't take focus, so wait until we have a position.
    if (entry.noFocus || !pos || focused.current === entry) return;
    focused.current = entry;
    const el = ref.current!;
    const f = el.querySelector<HTMLElement>('[data-autofocus]') || el;
    f.focus({ preventScroll: true });
  }, [entry, pos]);
  return (
    <>
      {entry.modal && <div className="ink-modal-backdrop" style={{ zIndex: z }} onPointerDown={close} />}
      <div
        ref={ref}
        data-popover-id={entry.id}
        tabIndex={-1}
        className={'ink-popover ' + (entry.className || '')}
        style={{ position: 'fixed', zIndex: z, left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden', ...entry.style }}
        onMouseDown={(e) => { if (entry.noFocus && !(e.target as HTMLElement).closest('input,textarea')) e.preventDefault(); }}
      >
        {entry.render(close)}
      </div>
    </>
  );
}

/** Tooltip: dark chip below/above an element after a delay. */
let tipTimer: number | undefined;
export function showTooltip(target: HTMLElement, text: ReactNode, shortcut?: string, placement: Placement = 'bottom') {
  clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => {
    if (!target.isConnected || !target.matches(':hover')) return;
    openPopover({ id: 'tooltip', anchor: target.getBoundingClientRect(), placement, offset: 6, noFocus: true, zIndex: 5000, className: 'ink-tooltip-wrap',
      render: () => <div className="ink-tooltip"><div>{text}</div>{shortcut && <div className="ink-tooltip-sc">{shortcut}</div>}</div> });
    const leave = () => { closePopover('tooltip'); target.removeEventListener('mouseleave', leave); target.removeEventListener('pointerdown', leave); };
    target.addEventListener('mouseleave', leave); target.addEventListener('pointerdown', leave);
  }, 500);
}
export function tip(text: ReactNode, shortcut?: string, placement?: Placement) {
  return { onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTooltip(e.currentTarget, text, shortcut, placement) };
}
