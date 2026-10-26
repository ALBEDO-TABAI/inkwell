import { useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import { Icon, type IconName } from '../ui/icons';
import { openPopover, type Anchor } from '../ui/overlay';
import { EMOJI, CATEGORIES, searchEmoji, recentEmoji, pushRecentEmoji, randomEmoji } from './emoji-data';
import { caretRect } from './caret';

const CALLOUT_SET = '💡👉☝️👌🔑🚧⚠️🔥📌✂️❓🚫⛔⏰☎️🚨♻️✅🔒📎📖🗣️➡️📣🛠️⚙️';
const SKINS = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];

export function openEmojiPicker(opts: { anchor?: Anchor; onPick: (ch: string) => void; onRemove?: () => void; id?: string }) {
  const r = opts.anchor || caretRect() || new DOMRect(400, 200, 0, 0);
  openPopover({ id: opts.id || 'emoji-picker', anchor: r, placement: 'bottom-start', offset: 4, render: (close) => <EmojiPicker close={close} onPick={opts.onPick} onRemove={opts.onRemove} /> });
}

function splitGraphemes(s: string): string[] {
  const seg = (Intl as any).Segmenter ? new (Intl as any).Segmenter('en', { granularity: 'grapheme' }) : null;
  return seg ? Array.from(seg.segment(s), (x: any) => x.segment) : Array.from(s);
}

export function EmojiPicker({ close, onPick, onRemove }: { close: () => void; onPick: (ch: string) => void; onRemove?: () => void }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'emoji' | 'icons' | 'upload'>('emoji');
  const [skin, setSkin] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pick = (c: string) => { pushRecentEmoji(c); onPick(c); close(); };
  const applySkin = (e: { char: string; skins?: string[] }) => (skin && e.skins?.[skin - 1]) || e.char;
  const sections = useMemo(() => {
    if (q) return [{ key: 'results', label: '', items: searchEmoji(q).map((e) => applySkin(e)) }];
    const recent = recentEmoji().map((e) => e.char);
    const out = [] as { key: string; label: string; items: string[] }[];
    if (recent.length) out.push({ key: 'recent', label: t('emoji.recent'), items: recent });
    out.push({ key: 'callout', label: t('b.callout'), items: splitGraphemes(CALLOUT_SET) });
    for (const c of CATEGORIES) out.push({ key: c.key, label: t('emoji.cat.' + c.key), items: EMOJI.filter((e) => c.groups.includes(e.group)).map((e) => applySkin(e)) });
    return out;
  }, [q, skin]);
  const jump = (key: string) => { const el = scrollRef.current?.querySelector<HTMLElement>(`[data-sec="${key}"]`); if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 4; };
  return (
    <div className="ink-emoji-picker">
      <div className="ink-ep-tabs">
        {(['emoji', 'icons', 'upload'] as const).map((k) => <span key={k} className={'ink-ep-tab' + (tab === k ? ' is-active' : '')} onClick={() => setTab(k)}>{t('emoji.tab.' + k)}</span>)}
        <span className="ink-ep-spacer" />
        {onRemove && <span className="ink-ep-tab" onClick={() => { onRemove(); close(); }}>{t('emoji.remove')}</span>}
      </div>
      {tab === 'emoji' ? (
        <>
          <div className="ink-ep-search">
            <div className="ink-ep-input"><Icon name="search" size={16} stroke={1.6} /><input data-autofocus placeholder={t('emoji.filter')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const first = sections[0]?.items[0]; if (first) pick(first); } }} /></div>
            <span className="ink-ep-btn" title={t('emoji.random')} onClick={() => pick(randomEmoji())}><Icon name="shuffle" size={16} stroke={1.8} /></span>
            <span className="ink-ep-btn ink-ep-skin" title={t('emoji.skin')} onClick={() => setSkin((s) => (s + 1) % SKINS.length)}>{SKINS[skin]}</span>
          </div>
          <div className="ink-ep-scroll" ref={scrollRef}>
            {sections.map((s) => (
              <div key={s.key} data-sec={s.key} className="ink-ep-section">
                {s.label && <div className="ink-ep-label">{s.label}</div>}
                <div className="ink-ep-grid">{s.items.map((c, i) => <span key={c + i} className="ink-emoji-cell" onClick={() => pick(c)}>{c}</span>)}</div>
              </div>
            ))}
            {q && !sections[0].items.length && <div className="ink-menu-empty">{t('common.noResults')}</div>}
          </div>
          <div className="ink-ep-cats">
            <span className="ink-ep-cat is-active" onClick={() => jump('recent')}><Icon name="clock" size={20} stroke={1.5} /></span>
            {CATEGORIES.map((c) => <span key={c.key} className="ink-ep-cat" title={t('emoji.cat.' + c.key)} onClick={() => jump(c.key)}><Icon name={c.icon as IconName} size={20} stroke={1.5} /></span>)}
            <span className="ink-ep-cat" title={t('emoji.custom')} onClick={() => setTab('upload')}><Icon name="apps" size={20} stroke={1.5} /></span>
            <span className="ink-ep-cat ink-ep-cat-add" title={t('emoji.uploadButton')} onClick={() => setTab('upload')}><Icon name="plusCircle" size={20} stroke={1.5} /></span>
          </div>
        </>
      ) : tab === 'icons' ? (
        <div className="ink-ep-scroll ink-ep-icons">
          <div className="ink-ep-grid">
            {(['page', 'home', 'star', 'bulb', 'flag', 'bell', 'calendar', 'users', 'pencil', 'code', 'globe', 'mail', 'lock', 'image', 'video', 'bookmark', 'leaf', 'plane', 'ball', 'carrot', 'symbols', 'clock', 'settings', 'library'] as IconName[]).map((n) => (
              <span key={n} className="ink-emoji-cell" onClick={() => { onPick('icon:' + n); close(); }}><Icon name={n} size={20} stroke={1.6} /></span>
            ))}
          </div>
        </div>
      ) : (
        <div className="ink-ep-upload"><button className="ink-btn">{t('emoji.uploadButton')}</button><div className="ink-muted ink-small">{t('emoji.uploadHint')}</div></div>
      )}
    </div>
  );
}
