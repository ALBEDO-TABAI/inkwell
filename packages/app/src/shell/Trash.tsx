import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openPopover } from '../ui/overlay';
import { useStoreVersion } from '../hooks/useStore';
import { pageTitle, restorePage } from '../app/pages';
import { navigate } from '../app/state';

export function openTrash() {
  const sb = document.querySelector('.ink-sidebar')?.getBoundingClientRect();
  const left = (sb?.right ?? 270) - 37;
  openPopover({
    id: 'trash', anchor: { left, right: left, top: 371, bottom: 371 }, placement: 'bottom-start', offset: 0,
    render: (close) => <TrashPanel close={close} />,
  });
}

function TrashPanel({ close }: { close: () => void }) {
  useStoreVersion();
  const [q, setQ] = useState('');
  const items = store.space.trash.map((id) => store.get(id)).filter((b) => b && pageTitle(b).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ink-trash">
      <div className="ink-trash-top">
        <input data-autofocus className="ink-menu-search" placeholder={t('trash.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ink-trash-chips">
          <span className="ink-chip is-accent"><Icon name="user" size={14} stroke={1.8} />{t('trash.lastEditedBy')}<Icon name="chevronDown" size={12} stroke={2} /></span>
          <span className="ink-chip"><Icon name="file" size={14} stroke={1.8} />{t('trash.pages')}<Icon name="chevronDown" size={12} stroke={2} /></span>
          <span className="ink-chip"><Icon name="users" size={14} stroke={1.8} />{t('trash.teamspace')}<Icon name="chevronDown" size={12} stroke={2} /></span>
        </div>
      </div>
      <div className="ink-trash-list">
        {items.length === 0 ? (
          <div className="ink-trash-empty"><Icon name="trash" size={18} stroke={1.6} /><div>{t('common.noResults')}</div></div>
        ) : items.map((b) => (
          <div key={b!.id} className="ink-menu-item ink-trash-item" onClick={() => { navigate(b!.id); close(); }}>
            <span className="ink-menu-icon"><PageIcon block={b} size={20} /></span>
            <span className="ink-menu-text">{pageTitle(b)}</span>
            <span className="ink-trash-btn" role="button" title={t('trash.restore')} onClick={(e) => { e.stopPropagation(); restorePage(b!.id); }}><Icon name="history" size={16} /></span>
            <span className="ink-trash-btn" role="button" title={t('trash.deleteForever')} onClick={(e) => { e.stopPropagation(); store.transact('delete forever', (tx) => { tx.update(b!.id, { alive: false }); tx.space((s) => ({ ...s, trash: s.trash.filter((x) => x !== b!.id), privatePages: s.privatePages.filter((x) => x !== b!.id) })); }); }}><Icon name="trash" size={16} /></span>
          </div>
        ))}
      </div>
      <div className="ink-trash-footer"><span>{t('trash.footer')}</span><Icon name="help" size={14} stroke={1.6} /></div>
    </div>
  );
}
