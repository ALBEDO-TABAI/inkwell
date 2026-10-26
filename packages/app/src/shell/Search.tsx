import { useMemo, useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { plain } from '../store/model';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openPopover } from '../ui/overlay';
import { pageTitle, breadcrumbPath, isInTrash } from '../app/pages';
import { navigate } from '../app/state';

export function openSearch() {
  openPopover({ id: 'search', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', modal: true, className: 'ink-search-pop', render: (close) => <SearchModal close={close} /> });
}
function SearchModal({ close }: { close: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const out: { id: string; snippet?: string }[] = [];
    const s = q.trim().toLowerCase();
    for (const b of store.blocks.values()) {
      if (!b.alive || (b.type !== 'page' && b.type !== 'collection_view_page') || isInTrash(b.id) || b.parent.startsWith('page-db')) continue;
      if (!s || pageTitle(b).toLowerCase().includes(s)) { out.push({ id: b.id }); continue; }
      const hit = store.children(b.id).find((c) => plain(c.title).toLowerCase().includes(s));
      if (hit) out.push({ id: b.id, snippet: plain(hit.title) });
    }
    return out.slice(0, 30);
  }, [q]);
  const go = (id: string) => { navigate(id); close(); };
  return (
    <div className="ink-search" onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].id); }
    }}>
      <div className="ink-search-head"><Icon name="search" size={20} stroke={1.6} /><input data-autofocus placeholder={t('sidebar.search')} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} /></div>
      <div className="ink-search-body">
        <div className="ink-search-list">
          {results.map((r, i) => {
            const b = store.get(r.id)!;
            const path = breadcrumbPath(r.id).slice(0, -1).map((p) => pageTitle(p)).join(' / ');
            return (
              <div key={r.id} className={'ink-search-row' + (i === active ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={() => go(r.id)}>
                <span className="ink-menu-icon"><PageIcon block={b} size={20} /></span>
                <span className="ink-search-title">{pageTitle(b)}</span>
                {(r.snippet || path) && <span className="ink-search-path">{r.snippet || path}</span>}
              </div>
            );
          })}
          {!results.length && <div className="ink-menu-empty">{t('common.noResults')}</div>}
        </div>
      </div>
    </div>
  );
}
