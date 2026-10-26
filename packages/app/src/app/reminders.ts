/** Reminders: date mentions with `remind` fire a local notification (system Notification API — native in Electron)
 *  plus an in-app toast. Nothing leaves the machine. */
import { store } from '../store/store';
import type { Block, Marks } from '../store/model';
import { pageTitle } from './pages';
import { navigate } from './state';
import { toast } from '../ui/toast';
import { shellSend } from '../platform/bridge';

export interface Reminder { key: string; blockId: string; pageId: string; at: number; when: number; label: string }
const FIRED = 'inkwell:reminders:fired';
const fired = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(FIRED) || '[]')); } catch { return new Set(); } };
const markFired = (k: string) => { const s = fired(); s.add(k); try { localStorage.setItem(FIRED, JSON.stringify([...s].slice(-500))); } catch { /* ignore */ } };

export function mentionTime(m: NonNullable<Marks['mention']>): number {
  const d = new Date((m.value || '') + 'T' + (m.time || '09:00') + ':00');
  return d.getTime();
}
export function allReminders(): Reminder[] {
  const out: Reminder[] = [];
  for (const b of store.blocks.values()) {
    if (b.alive === false || !b.title) continue;
    b.title.forEach(([, m], i) => {
      const mm = m?.mention; if (!mm || mm.kind !== 'date' || mm.remind == null || !mm.value) return;
      const when = mentionTime(mm);
      const page = store.pageOf(b.id) as Block | undefined;
      out.push({ key: `${b.id}:${i}:${mm.value}T${mm.time || ''}-${mm.remind}`, blockId: b.id, pageId: page?.id || b.id, when, at: when - mm.remind * 60000, label: b.title!.map(([t, x]) => (x?.mention ? '' : t)).join('').trim() });
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

function fire(r: Reminder) {
  markFired(r.key);
  const title = pageTitle(store.get(r.pageId));
  const d = new Date(r.when);
  const body = (r.label ? r.label + ' · ' : '') + `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  toast('⏰ ' + title + ' — ' + body);
  shellSend('inkwell:reminder', { title, body, pageId: r.pageId });
  try {
    if (typeof Notification !== 'undefined') {
      const show = () => { const n = new Notification(title, { body, tag: r.key, silent: false }); n.onclick = () => { window.focus(); navigate(r.pageId); }; };
      if (Notification.permission === 'granted') show();
      else if (Notification.permission !== 'denied') void Notification.requestPermission().then((p) => { if (p === 'granted') show(); });
    }
  } catch { /* notifications unavailable */ }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
/** Re-plan after every store change: fire overdue reminders (within the last day) and arm a timer for the next one. */
function plan() {
  if (timer) { clearTimeout(timer); timer = null; }
  const now = Date.now(); const done = fired();
  const pending = allReminders().filter((r) => !done.has(r.key));
  for (const r of pending) if (r.at <= now && now - r.at < 86400000) fire(r);
  const next = pending.find((r) => r.at > now);
  if (next) timer = setTimeout(plan, Math.min(next.at - now, 2 ** 31 - 1));
}
export function startReminders() {
  if (started) return; started = true;
  let deb: ReturnType<typeof setTimeout> | null = null;
  store.subscribe(() => { if (deb) clearTimeout(deb); deb = setTimeout(plan, 500); });
  setTimeout(plan, 1000);
}
export const __plan = plan;
