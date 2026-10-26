/**
 * Storage backends. In Electron the main process owns a SQLite database (better-sqlite3);
 * in a plain browser (dev/testing) we fall back to IndexedDB.
 */
import type { Block, Space, User } from './model';
import { store } from './store';
import { buildFixture, type FixtureData } from './fixture';

export interface Snapshot { blocks: Block[]; space: Space; users: User[]; kv: Record<string, unknown> }
export interface Backend {
  kind: 'sqlite' | 'indexeddb' | 'memory';
  load(): Promise<Snapshot | null>;
  write(changes: { blocks: Block[]; space?: Space }): Promise<void>;
  reset(data: Snapshot): Promise<void>;
  kvSet(key: string, value: unknown): void;
}

declare global {
  interface Window {
    inkwellNative?: {
      platform: string;
      db: {
        load(): Promise<Snapshot | null>;
        write(changes: { blocks: Block[]; space?: Space }): Promise<void>;
        reset(data: Snapshot): Promise<void>;
        kvSet(key: string, value: unknown): void;
      };
      send(channel: string, ...args: unknown[]): void;
      on(channel: string, f: (...args: any[]) => void): () => void;
      invoke(channel: string, ...args: unknown[]): Promise<any>;
    };
  }
}

class IndexedDbBackend implements Backend {
  kind = 'indexeddb' as const;
  private dbp: Promise<IDBDatabase>;
  constructor(name = 'inkwell') {
    this.dbp = new Promise((res, rej) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('block', { keyPath: 'id' });
        db.createObjectStore('meta');
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  private async tx(stores: string[], mode: IDBTransactionMode) { return (await this.dbp).transaction(stores, mode); }
  async load(): Promise<Snapshot | null> {
    const t = await this.tx(['block', 'meta'], 'readonly');
    const get = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const space = await get(t.objectStore('meta').get('space'));
    if (!space) return null;
    const blocks = await get(t.objectStore('block').getAll());
    const users = (await get(t.objectStore('meta').get('users'))) || [];
    const kv = (await get(t.objectStore('meta').get('kv'))) || {};
    return { blocks, space, users, kv };
  }
  async write(changes: { blocks: Block[]; space?: Space }) {
    const t = await this.tx(['block', 'meta'], 'readwrite');
    const bs = t.objectStore('block');
    for (const b of changes.blocks) bs.put(b);
    if (changes.space) t.objectStore('meta').put(changes.space, 'space');
  }
  async reset(data: Snapshot) {
    const t = await this.tx(['block', 'meta'], 'readwrite');
    t.objectStore('block').clear();
    for (const b of data.blocks) t.objectStore('block').put(b);
    t.objectStore('meta').put(data.space, 'space');
    t.objectStore('meta').put(data.users, 'users');
    t.objectStore('meta').put(data.kv, 'kv');
    await new Promise((r) => (t.oncomplete = r));
  }
  private kv: Record<string, unknown> = {};
  async kvSet(key: string, value: unknown) {
    const t = await this.tx(['meta'], 'readwrite');
    const s = t.objectStore('meta');
    const r = s.get('kv');
    r.onsuccess = () => { const kv = r.result || {}; kv[key] = value; s.put(kv, 'kv'); };
  }
}

class NativeBackend implements Backend {
  kind = 'sqlite' as const;
  load() { return window.inkwellNative!.db.load(); }
  write(c: { blocks: Block[]; space?: Space }) { return window.inkwellNative!.db.write(c); }
  reset(d: Snapshot) { return window.inkwellNative!.db.reset(d); }
  kvSet(k: string, v: unknown) { window.inkwellNative!.db.kvSet(k, v); }
}

class MemoryBackend implements Backend {
  kind = 'memory' as const;
  async load() { return null; }
  async write() {}
  async reset() {}
  kvSet() {}
}

export let backend: Backend;
export let kv: Record<string, unknown> = {};

export function kvGet<T>(key: string, fallback: T): T { return (kv[key] as T) ?? fallback; }
export function kvPut(key: string, value: unknown) { kv[key] = value; backend?.kvSet(key, value); }

/**
 * Boot storage. `?fixture=rea` (or an empty database) seeds the fixture; `?storage=memory`
 * keeps everything in memory (used by the parity harness so runs are hermetic).
 */
export async function initPersistence(): Promise<string> {
  const q = new URLSearchParams(location.search);
  const forceFixture = q.has('fixture');
  if (window.inkwellNative) backend = new NativeBackend();
  else if (q.get('storage') === 'memory' || typeof indexedDB === 'undefined') backend = new MemoryBackend();
  else backend = new IndexedDbBackend();
  let snap: Snapshot | null = null;
  try { snap = forceFixture ? null : await backend.load(); } catch (e) { console.warn('storage load failed', e); }
  if (!snap) {
    const f: FixtureData = buildFixture();
    snap = f;
    await backend.reset(f).catch(() => {});
  }
  kv = snap.kv || {};
  store.load(snap);
  let pending: { blocks: Map<string, Block>; space?: Space } = { blocks: new Map() };
  let timer: number | undefined;
  store.onCommit = (c) => {
    for (const b of c.blocks) pending.blocks.set(b.id, b);
    if (c.space) pending.space = c.space;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const p = pending; pending = { blocks: new Map() };
      backend.write({ blocks: [...p.blocks.values()], space: p.space }).catch((e) => console.error('write failed', e));
    }, 120);
  };
  return backend.kind;
}
