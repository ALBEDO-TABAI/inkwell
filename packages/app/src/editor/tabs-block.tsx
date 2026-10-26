/** Tabs block: a strip of labelled tabs; each tab is a `tab` child block holding its own content. */
import { useContext } from 'react';
import type { Block } from '../store/model';
import { store, newId } from '../store/store';
import { useBlock } from '../hooks/useStore';
import { t } from '../i18n';
import { Icon } from '../ui/icons';
import { tip } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { Editable, LockContext } from './Editable';
import { BlockChildren } from './Blocks';
import { focusBlock } from './registry';

const mkText = (parent: string): Block => ({ id: newId(), type: 'text', title: [], parent, parentTable: 'block', content: [], alive: true, created: Date.now(), edited: Date.now() });
export function newTab(parent: string, label = ''): { tab: Block; text: Block } {
  const tab: Block = { id: newId(), type: 'tab', title: label ? [[label]] : [], parent, parentTable: 'block', content: [], alive: true, created: Date.now(), edited: Date.now() };
  const text = mkText(tab.id); tab.content = [text.id];
  return { tab, text };
}

export function TabsBlock({ b }: { b: Block; depth: number }) {
  useBlock(b.id);
  const locked = useContext(LockContext);
  const tabs = (b.content || []).map((id) => store.get(id)).filter((x): x is Block => !!x && x.alive !== false);
  const active = Math.min(Number(b.props?.active ?? 0), Math.max(0, tabs.length - 1));
  const cur = tabs[active];
  const activate = (i: number) => store.transact('tab', (tx) => tx.update(b.id, (x) => ({ props: { ...x.props, active: i } })), { noUndo: true });
  const add = () => {
    const { tab, text } = newTab(b.id, t('tabs.default', { n: tabs.length + 1 }));
    store.transact('add tab', (tx) => { tx.create(tab); tx.create(text); tx.insertChild(b.id, tab.id); tx.update(b.id, (x) => ({ props: { ...x.props, active: tabs.length } })); });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"] [contenteditable]`)?.focus());
  };
  const remove = (tab: Block) => {
    if (tabs.length <= 1) return;
    store.transact('delete tab', (tx) => { tx.removeChild(b.id, tab.id); tx.update(tab.id, { alive: false }); tx.update(b.id, (x) => ({ props: { ...x.props, active: Math.max(0, active - (tabs.indexOf(tab) <= active ? 1 : 0)) } })); });
  };
  const move = (tab: Block, dir: -1 | 1) => {
    const i = tabs.indexOf(tab), j = i + dir; if (j < 0 || j >= tabs.length) return;
    store.transact('move tab', (tx) => { tx.update(b.id, (x) => { const c = [...(x.content || [])]; const ai = c.indexOf(tab.id), bi = c.indexOf(tabs[j].id); [c[ai], c[bi]] = [c[bi], c[ai]]; return { content: c, props: { ...x.props, active: j } }; }); });
  };
  const menu = (e: React.MouseEvent, tab: Block) => {
    e.preventDefault();
    openMenu(new DOMRect(e.clientX, e.clientY, 0, 0), { width: 200, groups: [[
      { id: 'tab-rename', label: t('tabs.rename'), icon: 'rename', onSelect: () => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"] [contenteditable]`)?.focus()) },
      { id: 'tab-left', label: t('tabs.moveLeft'), icon: 'arrowLeft', disabled: tabs.indexOf(tab) === 0, onSelect: () => move(tab, -1) },
      { id: 'tab-right', label: t('tabs.moveRight'), icon: 'arrowRight', disabled: tabs.indexOf(tab) === tabs.length - 1, onSelect: () => move(tab, 1) },
      { id: 'tab-delete', label: t('tabs.delete'), icon: 'trash', danger: true, disabled: tabs.length <= 1, onSelect: () => remove(tab) },
    ]] }, { placement: 'bottom-start' });
  };
  return (
    <div className="ink-tabsblock">
      <div className="ink-tabs-bar" contentEditable={false}>
        {tabs.map((tab, i) => (
          <div key={tab.id} data-tab-id={tab.id} className={'ink-tabs-tab' + (i === active ? ' is-active' : '')} onMouseDown={() => { if (i !== active) activate(i); }} onContextMenu={(e) => !locked && menu(e, tab)}>
            <Editable block={tab} plainOnly placeholder={t('tabs.untitled')} alwaysPlaceholder />
          </div>
        ))}
        {!locked && <span className="ink-tabs-add" role="button" aria-label={t('tabs.add')} {...tip(t('tabs.add'))} onClick={add}><Icon name="plus" size={14} /></span>}
      </div>
      <div className="ink-tabs-panel">
        {cur && ((cur.content || []).some((id) => store.get(id)?.alive !== false)
          ? <BlockChildren parent={cur} depth={0} className="ink-children-flat" />
          : <div className="ink-toggle-empty" onMouseDown={(e) => { e.preventDefault(); const tx = mkText(cur.id); store.transact('add child', (s) => { s.create(tx); s.insertChild(cur.id, tx.id, 0); }); focusBlock(tx.id, 0); }}>{t('tabs.empty')}</div>)}
      </div>
    </div>
  );
}
