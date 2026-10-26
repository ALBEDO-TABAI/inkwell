import type { Block, Space, User } from './model';

/** A captured editor selection, restored on undo/redo. */
export type SelectionSnapshot =
  | { kind: 'text'; blockId: string; start: number; end: number }
  | { kind: 'blocks'; ids: string[] }
  | null;

interface Change { id: string; table: 'block' | 'space'; before: unknown; after: unknown }
interface Entry { label: string; changes: Change[]; selBefore: SelectionSnapshot; selAfter: SelectionSnapshot; coalesce?: string; at: number }

export interface Tx {
  get(id: string): Block | undefined;
  create(b: Omit<Block, 'created' | 'edited' | 'alive'> & Partial<Block>): Block;
  update(id: string, patch: Partial<Block> | ((b: Block) => Partial<Block>)): void;
  insertChild(parentId: string, childId: string, index?: number): void;
  removeChild(parentId: string, childId: string): void;
  space(fn: (s: Space) => Space): void;
}

type Listener = () => void;

export class RecordStore {
  blocks = new Map<string, Block>();
  space!: Space;
  users = new Map<string, User>();
  currentUser = 'user-1';
  private versions = new Map<string, number>();
  private listeners = new Set<Listener>();
  private idListeners = new Map<string, Set<Listener>>();
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  version = 0;
  /** persistence hook, set by the backend */
  onCommit?: (changes: { blocks: Block[]; space?: Space }) => void;
  /** returns the live editor selection; installed by the editor */
  captureSelection: () => SelectionSnapshot = () => null;

  load(data: { blocks: Block[]; space: Space; users: User[] }) {
    this.blocks.clear();
    for (const b of data.blocks) this.blocks.set(b.id, b);
    this.space = data.space;
    this.users.clear();
    for (const u of data.users) this.users.set(u.id, u);
    this.undoStack = []; this.redoStack = [];
    this.bump(null);
  }

  get(id: string | undefined | null): Block | undefined { return id ? this.blocks.get(id) : undefined; }
  getVersion(id: string) { return this.versions.get(id) ?? 0; }
  children(id: string): Block[] {
    const b = this.blocks.get(id);
    return (b?.content || []).map((c) => this.blocks.get(c)).filter((x): x is Block => !!x && x.alive);
  }
  parentOf(id: string): Block | undefined { const b = this.get(id); return b && b.parentTable === 'block' ? this.get(b.parent) : undefined; }
  /** nearest page ancestor (or itself when it is a page) */
  pageOf(id: string): Block | undefined {
    let b = this.get(id);
    while (b && b.type !== 'page' && b.type !== 'collection_view_page') b = b.parentTable === 'block' ? this.get(b.parent) : undefined;
    return b;
  }
  ancestors(id: string): Block[] {
    const out: Block[] = []; let b = this.get(id);
    while (b && b.parentTable === 'block') { const p = this.get(b.parent); if (!p) break; out.unshift(p); b = p; }
    return out;
  }

  subscribe(f: Listener) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  subscribeId(id: string, f: Listener) {
    let s = this.idListeners.get(id); if (!s) { s = new Set(); this.idListeners.set(id, s); }
    s.add(f); return () => { s!.delete(f); };
  }
  private bump(ids: Iterable<string> | null) {
    this.version++;
    if (ids) for (const id of ids) { this.versions.set(id, (this.versions.get(id) ?? 0) + 1); this.idListeners.get(id)?.forEach((f) => f()); }
    else { for (const id of this.blocks.keys()) this.versions.set(id, (this.versions.get(id) ?? 0) + 1); this.idListeners.forEach((s) => s.forEach((f) => f())); }
    this.listeners.forEach((f) => f());
  }

  /**
   * Run a transaction. All mutations are captured as before/after record snapshots,
   * which makes undo/redo exact. `coalesce` merges consecutive typing into one undo step.
   */
  transact(label: string, fn: (tx: Tx) => void, opts: { selAfter?: SelectionSnapshot; coalesce?: string; noUndo?: boolean; selBefore?: SelectionSnapshot } = {}) {
    const changes = new Map<string, Change>();
    const now = Date.now();
    const touch = (id: string, table: 'block' | 'space') => {
      if (!changes.has(id)) changes.set(id, { id, table, before: table === 'space' ? structuredClone(this.space) : structuredClone(this.blocks.get(id)), after: undefined });
    };
    const store = this;
    const tx: Tx = {
      get: (id) => store.blocks.get(id),
      create(b) {
        const full: Block = { alive: true, created: now, edited: now, createdBy: store.currentUser, editedBy: store.currentUser, ...b } as Block;
        touch(full.id, 'block'); store.blocks.set(full.id, full); return full;
      },
      update(id, patch) {
        const cur = store.blocks.get(id); if (!cur) return;
        touch(id, 'block');
        const p = typeof patch === 'function' ? patch(cur) : patch;
        store.blocks.set(id, { ...cur, ...p, edited: now, editedBy: store.currentUser });
      },
      insertChild(parentId, childId, index) {
        const p = store.blocks.get(parentId); if (!p) return;
        const content = (p.content || []).filter((c) => c !== childId);
        const i = index === undefined || index < 0 || index > content.length ? content.length : index;
        content.splice(i, 0, childId);
        tx.update(parentId, { content });
        const c = store.blocks.get(childId);
        if (c && (c.parent !== parentId || c.parentTable !== 'block')) tx.update(childId, { parent: parentId, parentTable: 'block' });
      },
      removeChild(parentId, childId) {
        const p = store.blocks.get(parentId); if (!p) return;
        tx.update(parentId, { content: (p.content || []).filter((c) => c !== childId) });
      },
      space(f) { touch(store.space.id, 'space'); store.space = f(structuredClone(store.space)); },
    };
    const selBefore = opts.selBefore !== undefined ? opts.selBefore : this.captureSelection();
    fn(tx);
    if (!changes.size) return;
    for (const c of changes.values()) c.after = c.table === 'space' ? structuredClone(this.space) : structuredClone(this.blocks.get(c.id));
    const list = [...changes.values()];
    if (!opts.noUndo) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (opts.coalesce && last && last.coalesce === opts.coalesce && now - last.at < 1500) {
        // merge: keep earliest `before`, latest `after`
        for (const c of list) {
          const ex = last.changes.find((x) => x.id === c.id);
          if (ex) ex.after = c.after; else last.changes.push(c);
        }
        last.selAfter = opts.selAfter ?? null; last.at = now;
      } else {
        this.undoStack.push({ label, changes: list, selBefore, selAfter: opts.selAfter ?? null, coalesce: opts.coalesce, at: now });
        if (this.undoStack.length > 500) this.undoStack.shift();
      }
      this.redoStack = [];
    }
    this.emit(list);
  }

  /** Apply records written by another tab/window (no undo entry, no persistence echo). */
  applyRemote(c: { blocks?: Block[]; space?: Space }) {
    for (const b of c.blocks || []) this.blocks.set(b.id, b);
    if (c.space) this.space = c.space;
    this.bump((c.blocks || []).map((b) => b.id).concat(c.space ? [c.space.id] : []));
  }

  private emit(list: Change[]) {
    const blocks: Block[] = []; let space: Space | undefined;
    for (const c of list) { if (c.table === 'space') space = this.space; else { const b = this.blocks.get(c.id); if (b) blocks.push(b); } }
    this.onCommit?.({ blocks, space });
    this.bump(list.map((c) => c.id));
  }

  private applySide(entry: Entry, side: 'before' | 'after') {
    for (const c of entry.changes) {
      const v = structuredClone(c[side]);
      if (c.table === 'space') this.space = v as Space;
      else if (v) this.blocks.set(c.id, v as Block);
      else { const cur = this.blocks.get(c.id); if (cur) this.blocks.set(c.id, { ...cur, alive: false }); }
    }
    this.emit(entry.changes);
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  undo(): SelectionSnapshot | undefined {
    const e = this.undoStack.pop(); if (!e) return undefined;
    this.applySide(e, 'before'); this.redoStack.push(e); return e.selBefore;
  }
  redo(): SelectionSnapshot | undefined {
    const e = this.redoStack.pop(); if (!e) return undefined;
    this.applySide(e, 'after'); this.undoStack.push(e); return e.selAfter;
  }
  /** break typing coalescing (e.g. after caret jumps) */
  sealUndo() { const last = this.undoStack[this.undoStack.length - 1]; if (last) last.coalesce = undefined; }
}

export const store = new RecordStore();

let idCounter = 0;
export function newId(): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(r, (x) => x.toString(16).padStart(2, '0')).join('') + (idCounter++).toString(36);
}
