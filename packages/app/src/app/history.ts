/** Page version history: snapshots of a page's block subtree, grouped per minute of editing. Local only. */
import { store } from '../store/store';
import type { Block } from '../store/model';
import { getUi } from './state';

export interface Snapshot { ts: number; user: string; blocks: Block[] }
const KEY = 'inkwell:history:';
const MAX = 60;
const GROUP_MS = 60_000;
const mem = new Map<string, Snapshot[]>();

const isPageLike = (b: Block) => b.type === 'page' || b.type === 'collection_view_page';
export function subtree(pageId: string): Block[] {
  const out: Block[] = []; const root = store.get(pageId); if (!root) return out;
  const walk = (b: Block, isRoot: boolean) => {
    out.push(structuredClone(b));
    if (!isRoot && isPageLike(b)) return; // child pages keep their own history
    for (const id of b.content || []) { const c = store.get(id); if (c && c.alive !== false) walk(c, false); }
  };
  walk(root, true); return out;
}
function load(pageId: string): Snapshot[] {
  let l = mem.get(pageId);
  if (!l) { try { l = JSON.parse(localStorage.getItem(KEY + pageId) || '[]'); } catch { l = []; } mem.set(pageId, l!); }
  return l!;
}
function save(pageId: string, l: Snapshot[]) {
  mem.set(pageId, l);
  if (new URLSearchParams(location.search).get('storage') === 'memory') return;
  try { localStorage.setItem(KEY + pageId, JSON.stringify(l.slice(-MAX))); } catch { /* quota: keep in memory */ }
}
export function snapshots(pageId: string): Snapshot[] { return load(pageId).slice().reverse(); }

/** Record the current state of a page: merged into the latest snapshot when inside the grouping window. */
export function record(pageId: string, ts = Date.now()) {
  const l = load(pageId).slice();
  const snap: Snapshot = { ts, user: store.currentUser, blocks: subtree(pageId) };
  if (!snap.blocks.length) return;
  const last = l[l.length - 1];
  if (last && JSON.stringify(last.blocks) === JSON.stringify(snap.blocks)) return;
  if (last && ts - last.ts < GROUP_MS && last.user === snap.user) l[l.length - 1] = { ...snap, ts: last.ts };
  else l.push(snap);
  save(pageId, l.slice(-MAX));
}

/** Restore a snapshot: blocks are written back and the page's content list is replaced (undoable). */
export function restore(pageId: string, snap: Snapshot) {
  record(pageId); // keep the pre-restore state as a version
  store.transact('restore version', (tx) => {
    for (const b of snap.blocks) {
      const { created: _c, edited: _e, ...rest } = b;
      if (tx.get(b.id)) tx.update(b.id, { ...rest, alive: true });
      else tx.create({ ...rest, alive: true });
    }
  });
  record(pageId);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
/** Start watching: the open page gets a baseline snapshot, then one per edit burst. */
export function startHistory() {
  if (started) return; started = true;
  const baseline = () => { const id = getUi().pageId; if (id && store.get(id) && !load(id).length) record(id, store.get(id)!.edited || Date.now()); };
  setTimeout(baseline, 0);
  store.subscribe(() => {
    baseline();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { const id = getUi().pageId; if (id && store.get(id)) record(id); }, 1500);
  });
}
