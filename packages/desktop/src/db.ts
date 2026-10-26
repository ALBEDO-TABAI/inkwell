/**
 * Local database owned by the main process. better-sqlite3 when its native module loads for this
 * Electron ABI; otherwise a JSON file with the same interface so the app still runs (logged loudly).
 */
import fs from 'node:fs';
import path from 'node:path';

export interface Snapshot { blocks: { id: string }[]; space: unknown; users: unknown[]; kv: Record<string, unknown> }
export interface Changes { blocks: { id: string }[]; space?: unknown }
export interface Store {
  kind: 'sqlite' | 'json';
  load(): Snapshot | null;
  write(c: Changes): void;
  reset(s: Snapshot): void;
  kvSet(key: string, value: unknown): void;
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS block (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
PRAGMA user_version = 1;
`;

function sqliteStore(file: string): Store {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(SCHEMA);
  const putBlock = db.prepare('INSERT INTO block (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
  const putMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const putKv = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
  const write = db.transaction((c: Changes) => {
    const now = Date.now();
    for (const b of c.blocks) putBlock.run(b.id, JSON.stringify(b), now);
    if (c.space !== undefined) putMeta.run('space', JSON.stringify(c.space));
  });
  const reset = db.transaction((s: Snapshot) => {
    db.exec('DELETE FROM block; DELETE FROM meta; DELETE FROM kv;');
    const now = Date.now();
    for (const b of s.blocks) putBlock.run(b.id, JSON.stringify(b), now);
    putMeta.run('space', JSON.stringify(s.space));
    putMeta.run('users', JSON.stringify(s.users));
    for (const [k, v] of Object.entries(s.kv || {})) putKv.run(k, JSON.stringify(v));
  });
  return {
    kind: 'sqlite',
    load() {
      const space = getMeta.get('space') as { value: string } | undefined;
      if (!space) return null;
      const blocks = (db.prepare('SELECT data FROM block').all() as { data: string }[]).map((r) => JSON.parse(r.data));
      const users = JSON.parse((getMeta.get('users') as { value: string } | undefined)?.value || '[]');
      const kv: Record<string, unknown> = {};
      for (const r of db.prepare('SELECT key, value FROM kv').all() as { key: string; value: string }[]) kv[r.key] = JSON.parse(r.value);
      return { blocks, space: JSON.parse(space.value), users, kv };
    },
    write: (c) => write(c),
    reset: (s) => reset(s),
    kvSet: (k, v) => { putKv.run(k, JSON.stringify(v)); },
    close: () => db.close(),
  };
}

function jsonStore(file: string): Store {
  let data: Snapshot | null = null;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = null; }
  let timer: NodeJS.Timeout | undefined;
  const flush = () => { if (data) { fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); } };
  const later = () => { clearTimeout(timer); timer = setTimeout(flush, 200); };
  return {
    kind: 'json',
    load: () => data,
    write(c) {
      if (!data) return;
      const byId = new Map(data.blocks.map((b) => [b.id, b]));
      for (const b of c.blocks) byId.set(b.id, b);
      data.blocks = [...byId.values()];
      if (c.space !== undefined) data.space = c.space;
      later();
    },
    reset(s) { data = s; flush(); },
    kvSet(k, v) { if (data) { data.kv = { ...data.kv, [k]: v }; later(); } },
    close() { clearTimeout(timer); flush(); },
  };
}

export function openStore(dir: string, dbFile: string): Store {
  fs.mkdirSync(dir, { recursive: true });
  try {
    return sqliteStore(path.join(dir, dbFile));
  } catch (e) {
    console.error('[inkwell] better-sqlite3 unavailable for this Electron build; falling back to JSON storage.', (e as Error).message);
    return jsonStore(path.join(dir, dbFile.replace(/\.db$/, '') + '.json'));
  }
}
