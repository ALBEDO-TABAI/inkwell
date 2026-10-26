/** Right sidebar: 更新/分析 (page updates from version snapshots) and 评论 (all discussions on the page). */
import { useMemo, useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { Block } from '../store/model';
import { useStoreVersion } from '../hooks/useStore';
import { Icon } from '../ui/icons';
import { tip } from '../ui/overlay';
import { useUi, setUi } from '../app/state';
import { pageTitle } from '../app/pages';
import { snapshots, subtree } from '../app/history';
import { toHtml, rtPlain } from '../editor/richtext';
import { inlineCtx } from '../editor/render-inline';
import { Avatar } from '../db/cells';
import { relTime } from './Search';
import { openHistory } from './History';
import { TopbarActions } from './Topbar';
import { CommentsPanelBody, PanelEmpty } from '../comments/Comments';

export function RightPanel() {
  const panel = useUi((s) => s.rightPanel);
  const pageId = useUi((s) => s.pageId);
  const [tab, setTab] = useState<'updates' | 'analytics'>('updates');
  if (!panel) return null;
  const tabs = panel === 'comments' ? [['comments', t('rp.comments')]] : [['updates', t('rp.updates')], ['analytics', t('rp.analytics')]];
  const cur = panel === 'comments' ? 'comments' : tab;
  return (
    <aside className="ink-rpanel" data-panel={panel}>
      <div className="ink-rp-top">
        <span className="ink-rp-close" role="button" aria-label={t('rp.close')} {...tip(t('rp.close'))} onClick={() => setUi({ rightPanel: null })}><Icon name="chevronsRight" size={18} stroke={1.8} /></span>
        <span style={{ flex: 1 }} />
        <TopbarActions pageId={pageId} />
      </div>
      <div className="ink-rp-tabs">
        {tabs.map(([k, label]) => <span key={k} className={'ink-rp-tab' + (cur === k ? ' is-active' : '')} role="tab" onClick={() => k !== 'comments' && setTab(k as 'updates' | 'analytics')}>{label}</span>)}
      </div>
      <div className="ink-rp-body">
        {cur === 'comments' && <CommentsPanelBody pageId={pageId} />}
        {cur === 'updates' && <Updates pageId={pageId} />}
        {cur === 'analytics' && <Analytics pageId={pageId} />}
      </div>
    </aside>
  );
}

interface Update { ts: number; user: string; verb: 'edited' | 'created'; blocks: Block[]; snapIndex: number }
const isPageLike = (b: Block) => b.type === 'page' || b.type === 'collection_view_page';
const sig = (b: Block) => JSON.stringify([b.type, b.title, b.props?.checked, b.format?.color]);

/** Diff consecutive snapshots: blocks added or changed in each version, in document order. */
export function pageUpdates(pageId: string): Update[] {
  const list = snapshots(pageId).slice().reverse(); // oldest first
  const out: Update[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const cur = list[i], prev = list[i - 1];
    const before = new Map((prev?.blocks || []).map((b) => [b.id, sig(b)]));
    const changed = cur.blocks.filter((b) => b.id !== pageId && b.alive !== false && before.get(b.id) !== sig(b) && (rtPlain(b.title) || isPageLike(b) || b.type === 'divider'));
    if (prev && !changed.length) continue;
    out.push({ ts: cur.ts, user: cur.user, verb: prev ? 'edited' : 'created', blocks: prev ? changed : cur.blocks.filter((b) => b.id !== pageId && (rtPlain(b.title) || isPageLike(b))), snapIndex: list.length - 1 - i });
  }
  if (!out.length) { const p = store.get(pageId); if (p) out.push({ ts: p.created || p.edited || Date.now(), user: store.currentUser, verb: 'created', blocks: subtree(pageId).filter((b) => b.id !== pageId && (rtPlain(b.title) || isPageLike(b))), snapIndex: 0 }); }
  return out;
}

function UpdateBlock({ b }: { b: Block }) {
  const cls = 'ink-up-line ink-up-' + b.type + (b.format?.color ? ' ink-up-colored' : '');
  if (isPageLike(b)) return <div className={cls}><Icon name={b.type === 'page' ? 'page' : 'table'} size={14} /><span>{pageTitle(b)}</span></div>;
  return (
    <div className={cls}>
      {b.type === 'bulleted_list' && <span className="ink-up-bullet">•</span>}
      {b.type === 'numbered_list' && <span className="ink-up-bullet">1.</span>}
      {b.type === 'to_do' && <span className={'ink-up-check' + (b.props?.checked ? ' is-on' : '')} />}
      <span dangerouslySetInnerHTML={{ __html: toHtml(b.title, inlineCtx) }} />
    </div>
  );
}

function UpdateEntry({ u, pageId }: { u: Update; pageId: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? u.blocks : u.blocks.slice(0, 5);
  const name = u.user === store.currentUser ? t('rp.you') : store.users.get(u.user)?.name || '?';
  return (
    <div className="ink-up-entry">
      <div className="ink-up-head">
        <Avatar userId={u.user} size={24} />
        <div className="ink-up-meta">
          <div className="ink-up-title"><span>{name}</span> {u.verb === 'created' ? t('rp.created') : t('rp.edited')} <b>{pageTitle(store.get(pageId))}</b></div>
          <div className="ink-up-time">{relTime(u.ts)}</div>
        </div>
        <span className="ink-up-hist" role="button" aria-label={t('pm.history')} {...tip(t('pm.history'))} onClick={() => openHistory(pageId)}><Icon name="history" size={14} /></span>
      </div>
      <div className="ink-up-blocks">{shown.map((b) => <UpdateBlock key={b.id} b={b} />)}</div>
      {!all && u.blocks.length > 5 && <div className="ink-up-more" role="button" onClick={() => setAll(true)}>{t('rp.seeMore', { n: u.blocks.length - 5 })}</div>}
    </div>
  );
}

function Updates({ pageId }: { pageId: string }) {
  const v = useStoreVersion();
  const list = useMemo(() => pageUpdates(pageId), [pageId, v]);
  if (!list.length) return <PanelEmpty icon="clock" title={t('rp.noUpdates')} />;
  return <div className="ink-rp-updates">{list.map((u, i) => <UpdateEntry key={u.ts + ':' + i} u={u} pageId={pageId} />)}</div>;
}

function Analytics({ pageId }: { pageId: string }) {
  useStoreVersion();
  const p = store.get(pageId);
  const views = Number(localStorage.getItem('inkwell:views:' + pageId) || 1);
  const words = subtree(pageId).reduce((n, b) => n + rtPlain(b.title).length, 0);
  return (
    <div className="ink-rp-analytics">
      <div className="ink-an-row"><span>{t('rp.views')}</span><b>{views}</b></div>
      <div className="ink-an-row"><span>{t('rp.chars')}</span><b>{words}</b></div>
      <div className="ink-an-row"><span>{t('rp.createdAt')}</span><b>{p?.created ? new Date(p.created).toLocaleString('zh-CN') : '—'}</b></div>
      <div className="ink-an-row"><span>{t('rp.editedAt')}</span><b>{p?.edited ? relTime(p.edited) : '—'}</b></div>
      <div className="ink-an-note">{t('rp.localOnly')}</div>
    </div>
  );
}
