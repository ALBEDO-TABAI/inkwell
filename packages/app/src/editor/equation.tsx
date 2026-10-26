import { useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { RichText } from '../store/model';
import { openPopover } from '../ui/overlay';
import { focusBlock } from './registry';
import { deleteRange } from './richtext';

function tokenAt(rt: RichText, at: number): number {
  let pos = 0;
  for (let i = 0; i < rt.length; i++) { if (pos === at && rt[i][1]?.eq !== undefined) return i; pos += rt[i][0].length; }
  return -1;
}

export function openEquationEditor(opts: { blockId: string; inlineAt?: number }) {
  const b = store.get(opts.blockId); if (!b) return;
  const host = opts.inlineAt !== undefined
    ? document.querySelectorAll(`[data-editable-id="${opts.blockId}"] [data-token="eq"]`)
    : document.querySelectorAll(`[data-block-id="${opts.blockId}"] .ink-equation`);
  let anchorEl: Element | undefined;
  if (opts.inlineAt !== undefined) {
    // find nth token by offset
    const rt = b.title || []; let pos = 0, n = 0;
    for (const s of rt) { if (s[1]?.eq !== undefined) { if (pos === opts.inlineAt) break; n++; } pos += s[0].length; }
    anchorEl = host[n];
  } else anchorEl = host[0];
  const r = anchorEl?.getBoundingClientRect() || document.querySelector(`[data-block-id="${opts.blockId}"]`)?.getBoundingClientRect() || new DOMRect(400, 300, 0, 0);
  openPopover({ id: 'equation', anchor: r, placement: opts.inlineAt !== undefined ? 'bottom-start' : 'bottom', offset: 6, render: (close) => <EqEditor {...opts} close={close} />,
    onClose: () => {
      const cur = store.get(opts.blockId);
      if (opts.inlineAt !== undefined && cur) {
        const i = tokenAt(cur.title || [], opts.inlineAt);
        if (i >= 0 && !cur.title![i][1]!.eq) store.transact('eq', (tx) => tx.update(opts.blockId, { title: deleteRange(cur.title || [], opts.inlineAt!, opts.inlineAt! + 1) }));
        focusBlock(opts.blockId, opts.inlineAt + 1);
      }
    } });
}

function EqEditor({ blockId, inlineAt, close }: { blockId: string; inlineAt?: number; close: () => void }) {
  const b = store.get(blockId)!;
  const initial = inlineAt !== undefined ? (b.title || [])[tokenAt(b.title || [], inlineAt)]?.[1]?.eq ?? '' : b.props?.tex ?? '';
  const [v, setV] = useState(initial);
  const update = (tex: string) => {
    setV(tex);
    store.transact('equation', (tx) => tx.update(blockId, (cur) => {
      if (inlineAt === undefined) return { props: { ...cur.props, tex } };
      const rt = structuredClone(cur.title || []); const i = tokenAt(rt, inlineAt);
      if (i >= 0) rt[i] = ['⁍', { ...rt[i][1], eq: tex }];
      return { title: rt };
    }), { coalesce: 'eq:' + blockId });
  };
  return (
    <div className="ink-eq-editor">
      <textarea data-autofocus className="ink-eq-input" value={v} placeholder={t('ed.equationPlaceholder')} spellCheck={false}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); close(); } }} />
      <button className="ink-btn ink-btn-primary" onClick={close}>{t('ed.eqDone')} ↵</button>
    </div>
  );
}
