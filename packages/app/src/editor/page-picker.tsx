import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { PageIcon } from '../ui/PageIcon';
import { openPopover } from '../ui/overlay';
import { pageTitle, isInTrash } from '../app/pages';

export function openPagePicker(anchor: DOMRect, onPick: (id: string) => void) {
  openPopover({ id: 'page-picker', anchor, placement: 'bottom-start', offset: 4, render: (close) => <PagePicker close={close} onPick={onPick} /> });
}
function PagePicker({ close, onPick }: { close: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const pages = [...store.blocks.values()].filter((b) => b.alive && (b.type === 'page' || b.type === 'collection_view_page') && !isInTrash(b.id) && !b.parent.startsWith('page-db') && pageTitle(b).toLowerCase().includes(q.toLowerCase())).slice(0, 20);
  return (
    <div className="ink-menu" style={{ width: 320 }} onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(pages.length - 1, a + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === 'Enter' && pages[active]) { e.preventDefault(); onPick(pages[active].id); close(); }
    }}>
      <div className="ink-menu-search-wrap"><input data-autofocus className="ink-menu-search" placeholder={t('ed.linkPlaceholder')} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} /></div>
      <div className="ink-menu-body" style={{ maxHeight: 300 }}><div className="ink-menu-group">
        <div className="ink-menu-label">{t('ed.linkTo')}</div>
        {pages.map((p, i) => (
          <div key={p.id} className={'ink-menu-item' + (i === active ? ' is-active' : '')} onMouseMove={() => setActive(i)} onClick={() => { onPick(p.id); close(); }}>
            <span className="ink-menu-icon"><PageIcon block={p} size={20} /></span><span className="ink-menu-text">{pageTitle(p)}</span>
          </div>
        ))}
        {!pages.length && <div className="ink-menu-empty">{t('common.noResults')}</div>}
      </div></div>
    </div>
  );
}
