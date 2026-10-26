/** Clicking a date mention opens the date picker: change the date, include a time, set a reminder. */
import { useEffect, useState } from 'react';
import { store } from '../store/store';
import type { Marks, RichText } from '../store/model';
import { openPopover } from '../ui/overlay';
import { DatePicker } from '../db/editors';
import { setTitle } from './commands';

type DM = NonNullable<Marks['mention']>;
function updateMention(blockId: string, idx: number, patch: Partial<DM>) {
  const b = store.get(blockId); if (!b?.title) return;
  const title: RichText = b.title.map((s, i) => (i === idx && s[1]?.mention ? [s[0], { ...s[1], mention: { ...s[1].mention, ...patch } }] : s)) as RichText;
  // drop undefined keys so the mark stays clean
  const seg = title[idx]; if (seg?.[1]?.mention) for (const k of Object.keys(seg[1].mention) as (keyof DM)[]) if (seg[1].mention[k] === undefined) delete seg[1].mention[k];
  setTitle(blockId, title, false);
}
function DateMentionEditor({ blockId, idx, close }: { blockId: string; idx: number; close: () => void }) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((x) => x + 1)), []);
  const m = store.get(blockId)?.title?.[idx]?.[1]?.mention;
  useEffect(() => { if (!m) close(); });
  if (!m) return null;
  return <DatePicker value={m.value ? [m.value] : []} showEnd={false}
    onChange={(v) => updateMention(blockId, idx, { value: v[0] })}
    time={m.time} onTime={(t) => updateMention(blockId, idx, { time: t })}
    remind={m.remind ?? null} onRemind={(r) => updateMention(blockId, idx, { remind: r ?? undefined, time: m.time || (r != null && r < 1440 ? '09:00' : m.time) })} />;
}

document.addEventListener('click', (e) => {
  const span = (e.target as HTMLElement).closest?.('.ink-mention[data-token="mention"]') as HTMLElement | null; if (!span) return;
  let m: DM | null = null; try { m = JSON.parse(span.dataset.mention || 'null'); } catch { /* ignore */ }
  if (!m || m.kind !== 'date') return;
  const ed = span.closest<HTMLElement>('[data-editable-id]'); if (!ed) return;
  const blockId = ed.dataset.editableId!;
  const all = [...ed.querySelectorAll('[data-token]')]; const tokIdx = all.indexOf(span);
  // map the n-th token span to its segment index
  const title = store.get(blockId)?.title || []; let n = -1, idx = -1;
  title.forEach((s, i) => { if (s[1]?.mention || s[1]?.eq) { n++; if (n === tokIdx) idx = i; } });
  if (idx < 0) return;
  e.preventDefault();
  const r = span.getBoundingClientRect();
  openPopover({ id: 'mention-date', anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, placement: 'bottom-start', offset: 4, render: (close) => <DateMentionEditor blockId={blockId} idx={idx} close={close} /> });
});
