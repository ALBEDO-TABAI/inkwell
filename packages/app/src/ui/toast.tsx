import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

interface Toast { id: number; text: string; action?: { label: string; run: () => void } }
let toasts: Toast[] = [];
const subs = new Set<() => void>();
let seq = 0;
export function toast(text: string, action?: Toast['action']) {
  const id = ++seq;
  toasts = [...toasts, { id, text, action }];
  subs.forEach((f) => f());
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); subs.forEach((f) => f()); }, 3000);
}
export function ToastHost() {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => toasts);
  return createPortal(
    <div className="ink-toasts">{list.map((t) => (
      <div key={t.id} className="ink-toast">{t.text}{t.action && <span className="ink-toast-action" onClick={t.action.run}>{t.action.label}</span>}</div>
    ))}</div>, document.body);
}
