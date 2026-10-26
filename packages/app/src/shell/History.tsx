/** Version history modal (page menu → 版本历史): snapshot list on the left, read-only preview on the right. */
import { useMemo, useState } from 'react';
import { openPopover } from '../ui/overlay';
import { Icon } from '../ui/icons';
import { store } from '../store/store';
import type { Block } from '../store/model';
import { toHtml } from '../editor/richtext';
import { inlineCtx, renderTex } from '../editor/render-inline';
import { pageTitle } from '../app/pages';
import { record, restore, snapshots, type Snapshot } from '../app/history';
import { formatEdited } from './MenuFooter';
import { toast } from '../ui/toast';

export function openHistory(pageId: string) {
  record(pageId);
  openPopover({ id: 'history', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', modal: true, className: 'ink-history-pop', render: (close) => <HistoryModal pageId={pageId} close={close} /> });
}

function HistoryModal({ pageId, close }: { pageId: string; close: () => void }) {
  const list = useMemo(() => snapshots(pageId), [pageId]);
  const [sel, setSel] = useState(0);
  const snap = list[sel];
  const page = store.get(pageId);
  return (
    <div className="ink-history" role="dialog" aria-label="版本历史">
      <aside className="ink-hist-side">
        <div className="ink-hist-head">
          <div className="ink-hist-kicker">版本历史</div>
          <div className="ink-hist-title">{pageTitle(page)}</div>
          <span className="ink-hist-group">分组方式 1分钟<Icon name="chevronDown" size={12} /></span>
        </div>
        <div className="ink-hist-list">
          {list.map((s, i) => (
            <div key={s.ts + ':' + i} className={'ink-hist-item' + (i === sel ? ' is-active' : '')} role="button" onClick={() => setSel(i)}>
              <div className="ink-hist-time">{formatEdited(s.ts)}</div>
              <div className="ink-hist-user"><span className="ink-hist-dot" />{store.users.get(s.user)?.name || '?'}</div>
              {i === sel && <span className="ink-hist-item-tools"><Icon name="bookmark" size={14} /><span className="ink-hist-chev"><Icon name="chevronRight" size={12} /></span></span>}
            </div>
          ))}
        </div>
      </aside>
      <section className="ink-hist-main">
        <header className="ink-hist-bar">
          <span className="ink-hist-bar-time">{snap ? formatEdited(snap.ts) : ''}</span>
          {sel === 0 && <span className="ink-hist-current">当前版本</span>}
          <span style={{ flex: 1 }} />
          <button className="ink-hist-restore" disabled={sel === 0 || !snap} onClick={() => { if (!snap) return; restore(pageId, snap); close(); toast('已恢复到 ' + formatEdited(snap.ts)); }}><Icon name="history" size={14} />开始恢复</button>
          <button className="ink-hist-close" aria-label="关闭" onClick={close}><Icon name="x" size={18} /></button>
        </header>
        <div className="ink-hist-preview">{snap && <SnapshotView snap={snap} rootId={pageId} />}</div>
      </section>
    </div>
  );
}

const TAG: Record<string, string> = { header: 'h1', sub_header: 'h2', sub_sub_header: 'h3', header_4: 'h4' };
function SnapshotView({ snap, rootId }: { snap: Snapshot; rootId: string }) {
  const by = new Map(snap.blocks.map((b) => [b.id, b]));
  const root = by.get(rootId);
  const html = (b: Block) => ({ __html: toHtml(b.title, inlineCtx) });
  const kids = (b: Block) => (b.content || []).map((id) => by.get(id)).filter(Boolean) as Block[];
  const render = (list: Block[], depth: number): React.ReactNode[] => {
    let n = 0;
    return list.map((b) => {
      n = b.type === 'numbered_list' ? n + 1 : 0;
      const children = b.type === 'page' || b.type === 'collection_view_page' ? null : kids(b).length ? <div className="ink-hs-children">{render(kids(b), depth + 1)}</div> : null;
      switch (b.type) {
        case 'header': case 'sub_header': case 'sub_sub_header': case 'header_4': { const T = TAG[b.type] as 'h1'; return <T key={b.id} className={'ink-hs-' + b.type} dangerouslySetInnerHTML={html(b)} />; }
        case 'bulleted_list': return <div key={b.id} className="ink-hs-li"><span className="ink-hs-marker">{['•', '◦', '▪'][depth % 3]}</span><div><div dangerouslySetInnerHTML={html(b)} />{children}</div></div>;
        case 'numbered_list': return <div key={b.id} className="ink-hs-li"><span className="ink-hs-marker">{depth % 3 === 1 ? String.fromCharCode(96 + n) : depth % 3 === 2 ? ['i', 'ii', 'iii', 'iv', 'v', 'vi'][n - 1] || n : n}.</span><div><div dangerouslySetInnerHTML={html(b)} />{children}</div></div>;
        case 'to_do': return <div key={b.id} className={'ink-hs-li ink-hs-todo' + (b.props?.checked ? ' is-checked' : '')}><span className={'ink-hs-check' + (b.props?.checked ? ' is-on' : '')}>{b.props?.checked ? <Icon name="check" size={12} /> : null}</span><div><div dangerouslySetInnerHTML={html(b)} />{children}</div></div>;
        case 'toggle': return <div key={b.id} className="ink-hs-li"><span className="ink-hs-marker"><Icon name="chevronRight" size={14} /></span><div dangerouslySetInnerHTML={html(b)} /></div>;
        case 'quote': return <blockquote key={b.id} className="ink-hs-quote"><div dangerouslySetInnerHTML={html(b)} />{children}</blockquote>;
        case 'callout': return <div key={b.id} className="ink-hs-callout"><span>{b.format?.page_icon && !b.format.page_icon.startsWith('icon:') ? b.format.page_icon : '💡'}</span><div><div dangerouslySetInnerHTML={html(b)} />{children}</div></div>;
        case 'code': return <pre key={b.id} className="ink-hs-code">{(b.title || []).map((s) => s[0]).join('')}</pre>;
        case 'divider': return <hr key={b.id} className="ink-hs-hr" />;
        case 'equation': return <div key={b.id} className="ink-hs-eq" dangerouslySetInnerHTML={{ __html: renderTex(String(b.props?.tex || ''), true) }} />;
        case 'page': case 'collection_view_page': return <div key={b.id} className="ink-hs-pagelink"><Icon name={b.type === 'page' ? 'page' : 'table'} size={16} /><span>{pageTitle(b)}</span></div>;
        case 'table_of_contents': return <div key={b.id} className="ink-hs-muted">添加标题块以创建目录。<u>了解更多</u>。</div>;
        case 'column_list': return <div key={b.id} className="ink-hs-cols">{kids(b).map((c) => <div key={c.id} className="ink-hs-col">{render(kids(c), depth)}</div>)}</div>;
        case 'text': return <div key={b.id} className="ink-hs-text"><div dangerouslySetInnerHTML={html(b)} />{children}</div>;
        default: return <div key={b.id} className="ink-hs-media">{b.type === 'image' ? '图片' : b.type === 'video' ? '视频' : b.type === 'bookmark' ? (b.props?.bookmark?.title || '书签') : b.type === 'table' ? '表格' : b.type}</div>;
      }
    });
  };
  if (!root) return null;
  return (
    <div className="ink-hs-page">
      <h1 className="ink-hs-title">{pageTitle(root)}</h1>
      {render(kids(root), 0)}
    </div>
  );
}
