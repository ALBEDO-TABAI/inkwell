import { store, newId } from '../store/store';
import type { Block } from '../store/model';
import { plain } from '../store/model';
import { t } from '../i18n';
import { navigate, getUi } from './state';

export const PAGE_TYPES = ['page', 'collection_view_page'];
export const isPage = (b?: Block) => !!b && PAGE_TYPES.includes(b.type);

export function pageTitle(b?: Block): string {
  if (!b) return '';
  if (b.type === 'alias') return pageTitle(store.get(b.props?.target));
  const s = plain(b.title);
  return s || t('common.untitled');
}
/** Children shown in the sidebar tree: sub-pages, link-to-page aliases, databases. */
export function sidebarChildren(id: string): Block[] {
  const out: Block[] = [];
  const walk = (pid: string) => {
    for (const c of store.children(pid)) {
      if (c.type === 'page' || c.type === 'collection_view_page' || c.type === 'alias') { if (!(c.type === 'alias' && !store.get(c.props?.target)?.alive)) out.push(c); }
      else if (c.type === 'column_list' || c.type === 'column' || c.type === 'toggle' || c.type === 'synced' || (c.content?.length && c.type !== 'collection_view_page')) walk(c.id);
    }
  };
  const b = store.get(id);
  if (b?.type === 'collection_view_page') return [];
  walk(id);
  return out;
}
export function breadcrumbPath(id: string): Block[] {
  const out: Block[] = [];
  let b = store.get(id);
  while (b) { if (isPage(b)) out.unshift(b); b = b.parentTable === 'block' ? store.get(b.parent) : undefined; }
  return out;
}
export function isInTrash(id: string): boolean {
  let b = store.get(id);
  while (b) { if (!b.alive || store.space.trash.includes(b.id)) return true; b = b.parentTable === 'block' ? store.get(b.parent) : undefined; }
  return false;
}

export function createPage(parent: string | 'private', opts: { open?: boolean; title?: string } = {}): string {
  const id = newId();
  const textId = newId();
  store.transact('new page', (tx) => {
    if (parent === 'private') {
      tx.create({ id, type: 'page', title: opts.title ? [[opts.title]] : [], parent: store.space.id, parentTable: 'space', content: [textId] });
      tx.space((s) => ({ ...s, privatePages: [...s.privatePages, id] }));
    } else {
      tx.create({ id, type: 'page', title: opts.title ? [[opts.title]] : [], parent, parentTable: 'block', content: [textId] });
      tx.insertChild(parent, id);
    }
    tx.create({ id: textId, type: 'text', title: [], parent: id, parentTable: 'block', content: [] });
  });
  if (opts.open !== false) navigate(id);
  return id;
}

function cloneTree(tx: Parameters<Parameters<typeof store.transact>[1]>[0], srcId: string, parent: string, parentTable: 'block' | 'space'): string {
  const src = store.get(srcId)!;
  const id = newId();
  const kids = (src.content || []).filter((c) => store.get(c)?.alive).map((c) => cloneTree(tx, c, id, 'block'));
  tx.create({ ...structuredClone(src), id, parent, parentTable, content: kids });
  return id;
}
export function duplicateBlock(id: string): string | undefined {
  const b = store.get(id); if (!b) return;
  let nid = '';
  store.transact('duplicate', (tx) => {
    if (b.parentTable === 'space') {
      nid = cloneTree(tx, id, b.parent, 'space');
      tx.space((s) => {
        const arr = [...s.privatePages]; const i = arr.indexOf(id); arr.splice(i < 0 ? arr.length : i + 1, 0, nid);
        return { ...s, privatePages: arr };
      });
    } else {
      nid = cloneTree(tx, id, b.parent, 'block');
      const p = store.get(b.parent)!;
      tx.insertChild(b.parent, nid, (p.content || []).indexOf(id) + 1);
    }
  });
  return nid;
}
export function trashPage(id: string) {
  store.transact('trash', (tx) => {
    tx.space((s) => ({ ...s, trash: [...s.trash.filter((x) => x !== id), id], favorites: s.favorites.filter((x) => x !== id) }));
  });
  if (isInTrash(getUi().pageId)) {
    const fallback = store.space.privatePages.find((p) => !isInTrash(p));
    if (fallback) navigate(fallback);
  }
}
export function restorePage(id: string) {
  store.transact('restore', (tx) => tx.space((s) => ({ ...s, trash: s.trash.filter((x) => x !== id) })));
}
export function toggleFavorite(id: string) {
  store.transact('favorite', (tx) => tx.space((s) => ({ ...s, favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })));
}
export function setPageFormat(id: string, patch: Partial<NonNullable<Block['format']>>, label = 'page format') {
  store.transact(label, (tx) => tx.update(id, (b) => ({ format: { ...b.format, ...patch } })));
}
export function renamePage(id: string, title: string) {
  store.transact('rename', (tx) => tx.update(id, { title: title ? [[title]] : [] }));
}
export function countWords(id: string): { words: number; chars: number } {
  let text = '';
  const walk = (bid: string) => { for (const c of store.children(bid)) { if (c.type === 'page' || c.type === 'collection_view_page') continue; text += plain(c.title) + ' '; walk(c.id); } };
  walk(id);
  const chars = text.replace(/\s/g, '').length;
  const words = (text.match(/[A-Za-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  return { words, chars };
}
