/** Comments: discussions live on the block they are attached to (props.discussions), so they persist,
 *  undo and travel with the block. Inline threads also mark the commented text with `cm: <id>`;
 *  page-level threads sit on the page block with no mark. */
import { store } from '../store/store';
import type { Block, RichText } from '../store/model';
import { applyMark, rtPlain, slice } from '../editor/richtext';

export interface Comment { id: string; user: string; ts: number; rt: RichText; edited?: number }
export interface Discussion { id: string; comments: Comment[]; resolved?: boolean; quote?: string; created: number }
export interface DiscRef { blockId: string; d: Discussion }

const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 10);
export const discussionsOf = (b?: Block): Discussion[] => ((b?.props?.discussions as Discussion[] | undefined) || []);

function setDiscussions(blockId: string, label: string, fn: (l: Discussion[]) => Discussion[], extra?: (b: Block) => Partial<Block>) {
  store.transact(label, (tx) => tx.update(blockId, (b) => ({ ...(extra ? extra(b) : {}), props: { ...b.props, discussions: fn(discussionsOf(b)) } })));
}

/** Start an inline thread on [start,end) of a block's title. Returns the thread id. */
export function startInline(blockId: string, start: number, end: number, rt: RichText): string {
  const id = uid('disc');
  const b = store.get(blockId)!;
  const quote = rtPlain(slice(b.title || [], start, end));
  setDiscussions(blockId, 'comment', (l) => [...l, { id, created: Date.now(), quote, comments: [{ id: uid('c'), user: store.currentUser, ts: Date.now(), rt }] }],
    (blk) => ({ title: applyMark(blk.title || [], start, end, (m) => ({ ...m, cm: id })) }));
  return id;
}
/** Page-level (or row-level) discussion with no text anchor. */
export function startPageComment(pageId: string, rt: RichText): string {
  const id = uid('disc');
  setDiscussions(pageId, 'comment', (l) => [...l, { id, created: Date.now(), comments: [{ id: uid('c'), user: store.currentUser, ts: Date.now(), rt }] }]);
  return id;
}
export function reply(blockId: string, did: string, rt: RichText) {
  setDiscussions(blockId, 'reply', (l) => l.map((d) => (d.id === did ? { ...d, resolved: false, comments: [...d.comments, { id: uid('c'), user: store.currentUser, ts: Date.now(), rt }] } : d)));
}
export function editComment(blockId: string, did: string, cid: string, rt: RichText) {
  setDiscussions(blockId, 'edit comment', (l) => l.map((d) => (d.id === did ? { ...d, comments: d.comments.map((c) => (c.id === cid ? { ...c, rt, edited: Date.now() } : c)) } : d)));
}
export function setResolved(blockId: string, did: string, resolved: boolean) {
  setDiscussions(blockId, resolved ? 'resolve' : 'reopen', (l) => l.map((d) => (d.id === did ? { ...d, resolved } : d)));
}
const unmark = (rt: RichText, did: string): RichText => rt.map(([t, m]) => (m?.cm === did ? [t, (({ cm: _c, ...r }) => (Object.keys(r).length ? r : undefined))(m)] : [t, m]) as any);
/** Delete one comment; deleting the last one removes the thread (and its highlight). */
export function deleteComment(blockId: string, did: string, cid: string) {
  const d = discussionsOf(store.get(blockId)).find((x) => x.id === did); if (!d) return;
  if (d.comments.length <= 1) return deleteDiscussion(blockId, did);
  setDiscussions(blockId, 'delete comment', (l) => l.map((x) => (x.id === did ? { ...x, comments: x.comments.filter((c) => c.id !== cid) } : x)));
}
export function deleteDiscussion(blockId: string, did: string) {
  setDiscussions(blockId, 'delete thread', (l) => l.filter((x) => x.id !== did), (b) => (b.title ? { title: unmark(b.title, did) } : {}));
}

/** Every discussion on a page: page-level first, then inline threads in document order. */
export function pageDiscussions(pageId: string): DiscRef[] {
  const out: DiscRef[] = []; const root = store.get(pageId); if (!root) return out;
  for (const d of discussionsOf(root)) out.push({ blockId: pageId, d });
  const walk = (b: Block) => {
    for (const id of b.content || []) {
      const c = store.get(id); if (!c || c.alive === false) continue;
      if (c.type === 'page' || c.type === 'collection_view_page') continue;
      for (const d of discussionsOf(c)) out.push({ blockId: c.id, d });
      walk(c);
    }
  };
  walk(root); return out;
}
export function findDiscussion(did: string): DiscRef | null {
  for (const b of store.blocks.values()) { const d = discussionsOf(b).find((x) => x.id === did); if (d) return { blockId: b.id, d }; }
  return null;
}
/** for the renderer: a thread highlight shows only while it is open */
let openCache: Map<string, boolean> | null = null;
store.subscribe(() => { openCache = null; });
export function commentOpen(did: string): boolean {
  if (!openCache) { openCache = new Map(); for (const b of store.blocks.values()) if (b.alive !== false) for (const d of discussionsOf(b)) openCache.set(d.id, !d.resolved); }
  return openCache.get(did) ?? false;
}
/** signature of the comment highlight state of a rich text (for re-render decisions) */
export const cmSig = (rt?: RichText) => (rt || []).filter(([, m]) => m?.cm).map(([, m]) => m!.cm + (commentOpen(m!.cm!) ? '1' : '0')).join(',');
