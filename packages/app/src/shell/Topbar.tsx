import { t } from '../i18n';
import { store } from '../store/store';
import { useBlock, useStoreVersion } from '../hooks/useStore';
import { Icon } from '../ui/icons';
import { PageIcon } from '../ui/PageIcon';
import { openMenu, type MenuSpec } from '../ui/menu';
import { openPopover, tip } from '../ui/overlay';
import { useUi, navigate, setTheme, getUi } from '../app/state';
import { breadcrumbPath, pageTitle, duplicateBlock, trashPage, toggleFavorite, setPageFormat } from '../app/pages';
import { EditedFooter } from './MenuFooter';
import { copyPageLink } from './RowMenu';
import { openMoveTo } from './MoveTo';
import { toast } from '../ui/toast';
import { pageToMarkdown } from '../editor/clipboard';

export function Topbar({ pageId }: { pageId: string }) {
  useStoreVersion();
  const page = useBlock(pageId);
  const hidden = useUi((s) => s.chromeHidden);
  const path = breadcrumbPath(pageId);
  const fav = store.space.favorites.includes(pageId);
  const inPrivate = path.length === 1 && store.space.privatePages.includes(path[0].id);
  return (
    <header className={'ink-topbar' + (hidden ? ' is-idle' : '')}>
      <div className="ink-topbar-left">
        {path.map((p, i) => (
          <span key={p.id} className="ink-crumb-wrap">
            {i > 0 && <span className="ink-crumb-sep">/</span>}
            <span className="ink-crumb" role="button" onClick={() => navigate(p.id)}>
              {p.format?.page_icon && <span className="ink-crumb-icon"><PageIcon block={p} size={16} emojiSize={14} /></span>}
              <span className="ink-crumb-text">{pageTitle(p)}</span>
            </span>
          </span>
        ))}
        {!!page?.props?.locked && (
          <span className="ink-crumb ink-locked-chip" role="button" {...tip('点击解锁页面')} onClick={() => store.transact('lock', (tx) => tx.update(pageId, (b) => ({ props: { ...b.props, locked: false } })))}>
            <Icon name="lock" size={12} stroke={2} /><span className="ink-crumb-text">已锁定</span>
          </span>
        )}
        {inPrivate && (
          <span className="ink-crumb ink-crumb-scope" role="button">
            <Icon name="lock" size={12} stroke={2} /><span className="ink-crumb-text">{t('top.private')}</span><Icon name="chevronDown" size={12} stroke={2} />
          </span>
        )}
      </div>
      <div className="ink-topbar-right">
        <span className="ink-topbar-btn ink-share-btn" role="button" onClick={(e) => openShare(e.currentTarget)}><Icon name="lock" size={12} stroke={2} /><span>{t('top.share')}</span></span>
        <span className="ink-topbar-icon" role="button" {...tip(t('top.copyLink'))} onClick={() => copyPageLink(pageId)}><Icon name="link" size={20} stroke={1.6} /></span>
        <span className={'ink-topbar-icon' + (fav ? ' is-fav' : '')} role="button" {...tip(fav ? t('top.unfavorite') : t('top.favorite'))} onClick={() => toggleFavorite(pageId)}><Icon name="star" size={20} stroke={1.6} style={fav ? { fill: '#F6C050', color: '#F6C050' } : undefined} /></span>
        <span className="ink-topbar-icon ink-more-btn" role="button" {...tip(t('top.more'))} onClick={(e) => page && openPageMenu(e.currentTarget, pageId)}><Icon name="more" size={20} stroke={2} /></span>
      </div>
    </header>
  );
}

function openShare(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const u = store.users.get(store.currentUser)!;
  openPopover({ id: 'share', anchor: r, placement: 'bottom-end', offset: 6, render: () => (
    <div className="ink-share">
      <div className="ink-share-tabs"><span className="ink-share-tab is-active">{t('share.tab.share')}</span><span className="ink-share-tab">{t('share.tab.publish')}</span></div>
      <div className="ink-share-body">
        <div className="ink-share-invite"><input className="ink-input" placeholder={t('share.invitePlaceholder')} data-autofocus /><button className="ink-btn ink-btn-primary" disabled>{t('share.invite')}</button></div>
        <div className="ink-share-user"><span className="ink-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.avatar}</span><div className="ink-share-user-text"><div>{u.name} <span className="ink-muted">{t('share.you')}</span></div><div className="ink-muted ink-small">{u.email}</div></div><span className="ink-muted ink-small">{t('share.fullAccess')}</span></div>
        <div className="ink-share-label">{t('share.generalAccess')}</div>
        <div className="ink-share-access"><span className="ink-share-access-icon"><Icon name="lock" size={16} stroke={1.8} /></span><span>{t('share.onlyInvited')}</span><Icon name="chevronDown" size={12} stroke={2} /></div>
      </div>
      <div className="ink-share-footer"><span className="ink-muted ink-small ink-share-learn"><Icon name="help" size={14} />{t('share.learn')}</span><button className="ink-btn" onClick={() => copyPageLink(getUi().pageId)}><Icon name="link" size={14} />{t('share.copyLink')}</button></div>
    </div>
  ) });
}

function FontCards({ pageId }: { pageId: string }) {
  const p = useBlock(pageId);
  const cur = p?.format?.page_font || 'default';
  const fonts: { id: 'default' | 'serif' | 'mono'; label: string }[] = [{ id: 'default', label: t('pm.font.default') }, { id: 'serif', label: t('pm.font.serif') }, { id: 'mono', label: t('pm.font.mono') }];
  return (
    <div className="ink-fontcards">
      {fonts.map((f) => (
        <div key={f.id} className={'ink-fontcard' + (cur === f.id ? ' is-active' : '')} role="button" onClick={() => setPageFormat(pageId, { page_font: f.id })}>
          <div className={'ink-fontcard-ag ink-font-' + f.id}>Ag</div>
          <div className="ink-fontcard-label">{f.label}</div>
        </div>
      ))}
    </div>
  );
}

export function appearanceSpec(pageId: string): MenuSpec {
  const p = store.get(pageId)!;
  const f = p.format || {};
  return {
    width: 286,
    groups: [
      [{ kind: 'label', label: t('pm.fontStyle') }, { kind: 'custom', key: 'fonts', render: () => <FontCards pageId={pageId} /> }],
      [
        { kind: 'label', label: t('pm.look') },
        { id: 'small', label: t('pm.smallText'), icon: 'smallText', toggle: !!f.page_small_text, onSelect: () => setPageFormat(pageId, { page_small_text: !store.get(pageId)!.format?.page_small_text }) },
        { id: 'full', label: t('pm.fullWidth'), icon: 'fullWidth', toggle: !!f.page_full_width, onSelect: () => setPageFormat(pageId, { page_full_width: !store.get(pageId)!.format?.page_full_width }) },
        { id: 'toc', label: t('pm.toc'), icon: 'toc', toggle: f.page_toc !== false, onSelect: () => setPageFormat(pageId, { page_toc: store.get(pageId)!.format?.page_toc === false }) },
        { id: 'disc', label: t('pm.discussion'), icon: 'comment', toggle: true, onSelect: () => {} },
        { id: 'inline', label: t('pm.inlineComments'), icon: 'comment', sub: () => ({ width: 220, groups: [[{ id: 'a', label: '默认', checked: true }, { id: 'b', label: '最小化' }]] }) },
      ],
      [
        { kind: 'label', label: t('pm.theme') },
        ...(['light', 'dark', 'system'] as const).map((th) => ({ id: 'th-' + th, label: t('pm.theme.' + th), icon: (th === 'light' ? 'sun' : th === 'dark' ? 'moon' : 'monitor') as any, checked: getUi().theme === th, onSelect: () => setTheme(th) })),
      ],
    ],
  };
}

import { openHistory } from './History';
export function openPageMenu(el: HTMLElement, pageId: string) {
  openMenu(el.getBoundingClientRect(), () => {
    const p = store.get(pageId)!;
    return {
      width: 256,
      search: t('pm.search'),
      groups: [
        [
          { id: 'link', label: t('pm.copyLink'), icon: 'link', shortcut: '⌘L', onSelect: () => copyPageLink(pageId) },
          { id: 'content', label: t('pm.copyContent'), icon: 'copy', onSelect: () => { navigator.clipboard?.writeText(pageToMarkdown(pageId)).catch(() => {}); toast(t('toast.linkCopied').replace('链接', '内容')); } },
          { id: 'dup', label: t('pm.duplicate'), icon: 'duplicate', shortcut: '⌘D', onSelect: () => { const n = duplicateBlock(pageId); if (n) navigate(n); } },
          { id: 'move', label: t('pm.moveTo'), icon: 'move', shortcut: '⌘⇧P', onSelect: () => setTimeout(() => openMoveTo(el, pageId)) },
          { id: 'history', label: t('pm.history'), icon: 'history', onSelect: () => setTimeout(() => openHistory(pageId)) },
          { id: 'analytics', label: t('pm.analytics'), icon: 'clock' },
        ],
        [{ id: 'appearance', label: t('pm.appearance'), icon: 'aa', keywords: ['font', 'small', 'full', 'theme', '字体', '小字号', '全宽'], sub: () => appearanceSpec(pageId) }],
        [{ id: 'ai', label: t('pm.useWithAi'), icon: 'ai', sub: () => ({ width: 220, groups: [[{ id: 'x', label: t('tb.skill.improve'), disabled: true }]] }) }],
        [
          { id: 'suggest', label: t('pm.suggest'), icon: 'suggest' },
          { id: 'notify', label: t('pm.notify'), icon: 'bell', right: <span className="ink-menu-value">{t('pm.notifyComments')}</span>, sub: () => ({ width: 220, groups: [[{ id: 'c', label: t('pm.notifyComments'), checked: true }]] }) },
          { id: 'offline', label: t('pm.offline'), icon: 'download', toggle: false },
        ],
        [
          { id: 'lock', label: t('pm.lock'), icon: 'lock', toggle: !!p.props?.locked, onSelect: () => store.transact('lock', (tx) => tx.update(pageId, (b) => ({ props: { ...b.props, locked: !b.props?.locked } }))) },
          { id: 'trash', label: t('pm.trash'), icon: 'trash', onSelect: () => trashPage(pageId) },
        ],
        [{ id: 'more', label: t('pm.more'), icon: 'more', sub: () => ({ width: 240, groups: [[{ id: 'import', label: t('pm.import'), icon: 'download' }, { id: 'export', label: t('pm.export'), icon: 'upload', onSelect: () => exportMarkdown(pageId) }]] }) }],
      ],
      footer: <EditedFooter block={p} counts="chars" />,
    };
  }, { anchorEl: el, placement: 'bottom-end', offset: 8 });
}

function exportMarkdown(pageId: string) {
  const md = pageToMarkdown(pageId);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  a.download = pageTitle(store.get(pageId)) + '.md';
  a.click();
}
