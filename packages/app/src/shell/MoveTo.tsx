import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { PageIcon } from '../ui/PageIcon';
import { openPopover } from '../ui/overlay';
import { pageTitle, isInTrash } from '../app/pages';

export function allPages(): string[] {
  const out: string[] = [];
  const walk = (id: string) => { const b = store.get(id); if (!b?.alive || isInTrash(id)) return; if (b.type === 'page') out.push(id); for (const c of b.content || []) walk(c); };
  store.space.privatePages.forEach(walk);
  store.space.teamspaces.forEach((ts) => ts.pages.forEach(walk));
  return out;
}

/** Move a block (or page) under another page. */
export function moveBlockTo(id: string, targetPage: string) {
  const b = store.get(id); if (!b || id === targetPage) return;
  if (store.ancestors(targetPage).some((a) => a.id === id)) return;
  store.transact('move', (tx) => {
    if (b.parentTable === 'space') tx.space((s) => ({ ...s, privatePages: s.privatePages.filter((x) => x !== id) }));
    else tx.removeChild(b.parent, id);
    tx.insertChild(targetPage, id);
  });
}

export function openMoveTo(anchorEl: HTMLElement | DOMRect, id: string | string[]) {
  const r = anchorEl instanceof HTMLElement ? anchorEl.getBoundingClientRect() : anchorEl;
  openPopover({ id: 'move-to', anchor: r, placement: 'bottom-start', offset: 4, render: (close) => <MoveTo ids={Array.isArray(id) ? id : [id]} close={close} /> });
}
function MoveTo({ ids, close }: { ids: string[]; close: () => void }) {
  const [q, setQ] = useState('');
  const pages = allPages().filter((p) => !ids.includes(p) && pageTitle(store.get(p)).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ink-menu" style={{ width: 320 }}>
      <div className="ink-menu-search-wrap"><input data-autofocus className="ink-menu-search" placeholder={t('move.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="ink-menu-body" style={{ maxHeight: 320 }}>
        <div className="ink-menu-group">
          <div className="ink-menu-label">{t('move.suggested')}</div>
          {pages.map((p) => (
            <div key={p} className="ink-menu-item" onClick={() => { ids.forEach((i) => moveBlockTo(i, p)); close(); }}>
              <span className="ink-menu-icon"><PageIcon block={store.get(p)} size={20} /></span><span className="ink-menu-text">{pageTitle(store.get(p))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
