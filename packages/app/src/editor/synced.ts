/** Synced blocks: the original holds the children; references point at it via props.target and render (and edit) the same children. */
import { store, newId } from '../store/store';
import type { Block } from '../store/model';
import { indexInParent } from './commands';

export const syncedSource = (b: Block): Block | undefined => (b.props?.target ? store.get(b.props.target as string) : b);
export const syncedRefs = (id: string) => [...store.blocks.values()].filter((b) => b.alive !== false && b.type === 'synced' && b.props?.target === id);

/** Insert a reference right after the synced block (the reference is what gets pasted elsewhere). */
export function copySynced(id: string): string | null {
  const b = store.get(id); if (!b) return null;
  const src = syncedSource(b); if (!src) return null;
  const ref: Block = { id: newId(), type: 'synced', title: [], parent: b.parent, parentTable: 'block', content: [], alive: true, created: Date.now(), edited: Date.now(), props: { target: src.id } };
  store.transact('copy synced', (tx) => { tx.create(ref); tx.insertChild(b.parent, ref.id, indexInParent(b) + 1); });
  return ref.id;
}

/** Turn a reference into an independent copy of the source's children. */
export function unsync(id: string) {
  const b = store.get(id); const src = b && syncedSource(b); if (!b || !src || src.id === b.id) return;
  const clone = (cid: string, parent: string, tx: { create: (x: Block) => void }): string => {
    const c = store.get(cid)!; const nid = newId();
    const kids = (c.content || []).filter((k) => store.get(k)?.alive !== false).map((k) => clone(k, nid, tx));
    tx.create({ ...structuredClone(c), id: nid, parent, content: kids, created: Date.now(), edited: Date.now() });
    return nid;
  };
  store.transact('unsync', (tx) => {
    const kids = (src.content || []).filter((k) => store.get(k)?.alive !== false).map((k) => clone(k, b.id, tx));
    tx.update(b.id, (x) => ({ content: kids, props: { ...x.props, target: undefined } }));
  });
}
