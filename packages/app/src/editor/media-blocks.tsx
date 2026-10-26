/** Media blocks (M6): image with resize handles / caption / alignment, video, audio, file, PDF, bookmark. */
import { useContext, useEffect, useRef, useState } from 'react';
import type { Block, RichText } from '../store/model';
import { store } from '../store/store';
import { t } from '../i18n';
import { Icon, type IconName } from '../ui/icons';
import { tip } from '../ui/overlay';
import { openMenu } from '../ui/menu';
import { toast } from '../ui/toast';
import { Editable, LockContext } from './Editable';
import { openMediaPopover, fetchOg, type MediaKind } from './media-popover';
import { resolveMedia } from '../page/media';
const useLocked = () => useContext(LockContext);

const fmt = (id: string, f: Record<string, unknown>, label = 'media') => store.transact(label, (tx) => tx.update(id, (b) => ({ format: { ...b.format, ...f } })));
const props = (id: string, p: Record<string, unknown>, label = 'media') => store.transact(label, (tx) => tx.update(id, (b) => ({ props: { ...b.props, ...p } })));
export const fileSize = (n?: number) => (!n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const nameOf = (b: Block) => (b.props?.fileName as string) || (() => { try { const u = new URL(String(b.props?.url || b.props?.src || '')); return decodeURIComponent(u.pathname.split('/').pop() || u.hostname); } catch { return t('media.untitledFile'); } })();
function download(url: string, name: string) { const a = document.createElement('a'); a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener'; a.click(); }

export function MediaPlaceholder({ b, kind, label }: { b: Block; kind: MediaKind; label: string }) {
  return (
    <div className="ink-media-ph ink-media-empty" contentEditable={false} role="button" onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => openMediaPopover(b, kind, (e.currentTarget as HTMLElement).getBoundingClientRect())}>
      <Icon name={kind as IconName} size={20} /><span>{label}</span>
    </div>
  );
}

/** Caption under media: editable; visible when non-empty or opened from the toolbar. */
function Caption({ b }: { b: Block }) {
  const cap = (b.props?.caption as RichText | undefined) || [];
  const open = !!cap.length || !!b.props?.captionOpen;
  if (!open) return null;
  return (
    <div className="ink-caption" data-caption-for={b.id}>
      <Editable block={b} value={cap} placeholder={t('media.captionPh')} alwaysPlaceholder onChange={(rt) => store.transact('caption', (tx) => tx.update(b.id, (x) => ({ props: { ...x.props, caption: rt } })), { coalesce: 'caption:' + b.id })} />
    </div>
  );
}
const openCaption = (b: Block) => { props(b.id, { captionOpen: true }, 'caption'); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-caption-for="${b.id}"] [contenteditable]`)?.focus()); };

/** Hover toolbar (top-right of media): alignment, caption, download / original, more. */
function MediaToolbar({ b, kind, url, align = true }: { b: Block; kind: MediaKind; url?: string; align?: boolean }) {
  const cur = b.format?.block_alignment || 'center';
  const Btn = ({ icon, label, onClick }: { icon: IconName; label: string; onClick: (e: React.MouseEvent<HTMLElement>) => void }) => (
    <span className="ink-mtb-btn" role="button" aria-label={label} {...tip(label, undefined, 'top')} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onClick(e); }}><Icon name={icon} size={16} /></span>
  );
  return (
    <div className="ink-mtb" contentEditable={false}>
      {align && <Btn icon={cur === 'left' ? 'alignLeft' : cur === 'right' ? 'alignRight' : 'alignCenter'} label={t('media.align')} onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 160, groups: [(['left', 'center', 'right'] as const).map((a) => ({ id: 'al-' + a, label: t('media.align.' + a), icon: (a === 'left' ? 'alignLeft' : a === 'right' ? 'alignRight' : 'alignCenter') as IconName, checked: cur === a, onSelect: () => fmt(b.id, { block_alignment: a }, 'align') }))] }, { placement: 'bottom-end' })} />}
      <Btn icon="captions" label={t('media.caption')} onClick={() => openCaption(b)} />
      {url && <Btn icon={kind === 'image' ? 'maximize' : 'download'} label={kind === 'image' ? t('media.original') : t('media.download')} onClick={() => (kind === 'image' ? window.open(url, '_blank') : download(url, nameOf(b)))} />}
      <Btn icon="more" label={t('tb.more')} onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 220, groups: [[
        { id: 'm-replace', label: t('media.replace'), icon: 'replace', onSelect: () => { const el = document.querySelector(`[data-block-id="${b.id}"]`); openMediaPopover(b, kind, (el || document.body).getBoundingClientRect()); } },
        ...(url ? [{ id: 'm-download', label: t('media.download'), icon: 'download' as IconName, onSelect: () => download(url, nameOf(b)) }] : []),
        ...(url && !url.startsWith('data:') ? [{ id: 'm-copy', label: t('media.copyLink'), icon: 'link' as IconName, onSelect: () => { navigator.clipboard?.writeText(url).catch(() => {}); toast(t('toast.linkCopied')); } }] : []),
        { id: 'm-caption', label: t('media.caption'), icon: 'captions', onSelect: () => openCaption(b) },
      ]] }, { placement: 'bottom-end' })} />
    </div>
  );
}

/** Side handles: drag to resize; centred media grows on both sides. */
function useResize(b: Block, boxRef: React.RefObject<HTMLDivElement | null>, min = 80) {
  const [live, setLive] = useState<number | null>(null);
  const start = (side: 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const box = boxRef.current!; const wrap = box.parentElement!;
    const w0 = box.getBoundingClientRect().width, max = wrap.getBoundingClientRect().width, x0 = e.clientX;
    const k = (b.format?.block_alignment || 'center') === 'center' ? 2 : 1;
    let w = w0;
    const move = (ev: PointerEvent) => { const dx = (ev.clientX - x0) * (side === 'right' ? 1 : -1) * k; w = Math.round(Math.max(min, Math.min(max, w0 + dx))); setLive(w); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('is-col-resizing'); setLive(null); if (w !== w0) fmt(b.id, { image_width: w >= max - 1 ? undefined : w }, 'resize'); };
    document.body.classList.add('is-col-resizing');
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return { live, start };
}
const Handles = ({ start }: { start: (s: 'left' | 'right') => (e: React.PointerEvent) => void }) => (
  <>
    <div className="ink-rs-handle is-left" onPointerDown={start('left')}><span /></div>
    <div className="ink-rs-handle is-right" onPointerDown={start('right')}><span /></div>
  </>
);

export function ImageBlock({ b }: { b: Block }) {
  const src = resolveMedia(b.props?.src);
  const aspect = b.format?.image_aspect ?? 316.06 / 704;
  const box = useRef<HTMLDivElement>(null);
  const { live, start } = useResize(b, box);
  const locked = useLocked();
  if (!src) return <MediaPlaceholder b={b} kind="image" label={t('ed.imagePlaceholder')} />;
  const w = live ?? b.format?.image_width;
  return (
    <div className={'ink-image ink-align-' + (b.format?.block_alignment || 'center')} contentEditable={false}>
      <div className="ink-media-box" ref={box} style={{ width: w ? w : '100%' }}>
        <div className="ink-image-frame" style={{ aspectRatio: String(1 / aspect) }}>
          <img src={src} alt={rtPlainSafe(b.props?.caption)} draggable={false} onLoad={(e) => {
            const im = e.currentTarget; if (b.format?.image_aspect || !im.naturalWidth) return;
            store.transact('image size', (tx) => tx.update(b.id, (x) => ({ format: { ...x.format, image_aspect: im.naturalHeight / im.naturalWidth } })), { noUndo: true });
          }} />
        </div>
        {!locked && <Handles start={start} />}
        {!locked && <MediaToolbar b={b} kind="image" url={src} />}
        {live != null && <div className="ink-rs-size">{live}px</div>}
      </div>
      <Caption b={b} />
    </div>
  );
}
const rtPlainSafe = (rt: unknown) => (Array.isArray(rt) ? (rt as RichText).map((s) => s[0]).join('') : '');

const embedUrl = (url: string): string | null => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/); if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/); if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
};
export function VideoBlock({ b }: { b: Block }) {
  const box = useRef<HTMLDivElement>(null);
  const { live, start } = useResize(b, box, 200);
  const locked = useLocked();
  const url = b.props?.url as string | undefined;
  if (!url) return <MediaPlaceholder b={b} kind="video" label={t('ed.videoPlaceholder')} />;
  const file = /^data:video|\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
  const emb = !file ? embedUrl(url) : null;
  const w = live ?? b.format?.image_width;
  return (
    <div className={'ink-video ink-align-' + (b.format?.block_alignment || 'center')} contentEditable={false}>
      <div className="ink-media-box" ref={box} style={{ width: w ? w : '100%' }}>
        <div className="ink-video-frame" style={{ aspectRatio: String(704 / 396.61) }}>
          {file ? <video className="ink-video-el" src={url} controls /> : emb ? <iframe className="ink-video-el" src={emb} title="video" allow="fullscreen; picture-in-picture" /> : <div className="ink-video-inner"><div className="ink-video-play"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></div><div className="ink-video-url">{url}</div></div>}
        </div>
        {!locked && <Handles start={start} />}
        {!locked && <MediaToolbar b={b} kind="video" url={file ? url : undefined} />}
      </div>
      <Caption b={b} />
    </div>
  );
}

export function AudioBlock({ b }: { b: Block }) {
  const url = b.props?.url as string | undefined;
  const locked = useLocked();
  if (!url) return <MediaPlaceholder b={b} kind="audio" label={t('ed.audioPlaceholder')} />;
  return (
    <div className="ink-audio" contentEditable={false}>
      <div className="ink-media-box" style={{ width: '100%' }}>
        <audio className="ink-audio-el" src={url} controls preload="metadata" />
        {!locked && <MediaToolbar b={b} kind="audio" url={url} align={false} />}
      </div>
      <Caption b={b} />
    </div>
  );
}

export function FileBlock({ b }: { b: Block }) {
  const url = b.props?.url as string | undefined;
  const locked = useLocked();
  if (!url) return <MediaPlaceholder b={b} kind="file" label={t('ed.filePlaceholder')} />;
  return (
    <div className="ink-fileblock" contentEditable={false}>
      <div className="ink-media-box ink-fileblock-row" role="link" onClick={() => download(url, nameOf(b))}>
        <Icon name="paperclip" size={18} />
        <span className="ink-fileblock-name">{nameOf(b)}</span>
        <span className="ink-fileblock-size">{fileSize(b.props?.fileSize as number)}</span>
        {!locked && <MediaToolbar b={b} kind="file" url={url} align={false} />}
      </div>
      <Caption b={b} />
    </div>
  );
}

export function PdfBlock({ b }: { b: Block }) {
  const url = b.props?.url as string | undefined;
  const locked = useLocked();
  const [h, setH] = useState<number | null>(null);
  if (!url) return <MediaPlaceholder b={b} kind="pdf" label={t('ed.pdfPlaceholder')} />;
  const height = h ?? b.format?.block_height ?? 520;
  const drag = (e: React.PointerEvent) => {
    e.preventDefault(); const y0 = e.clientY, h0 = height; let v = h0;
    const move = (ev: PointerEvent) => { v = Math.max(160, Math.round(h0 + ev.clientY - y0)); setH(v); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setH(null); fmt(b.id, { block_height: v }, 'resize'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <div className="ink-pdf" contentEditable={false}>
      <div className="ink-media-box" style={{ width: '100%' }}>
        <iframe className="ink-pdf-el" title={nameOf(b)} src={url} style={{ height }} />
        {h != null && <div className="ink-pdf-shield" />}
        {!locked && <div className="ink-rs-bottom" onPointerDown={drag}><span /></div>}
        {!locked && <MediaToolbar b={b} kind="pdf" url={url} align={false} />}
      </div>
      <Caption b={b} />
    </div>
  );
}

export function BookmarkBlock({ b }: { b: Block }) {
  const bm = b.props?.bookmark;
  const url = bm?.url || b.props?.url || '';
  // late OG fetch for bookmarks created elsewhere (paste-as-bookmark, imports)
  useEffect(() => { if (url && bm && bm.title === hostOf(url) && !b.props?.ogTried) { props(b.id, { ogTried: true }, 'og'); void fetchOg(url).then((og) => { if (og) props(b.id, { bookmark: og }, 'og'); }); } }, [url]);
  if (!bm && !b.props?.url) return <MediaPlaceholder b={b} kind="bookmark" label={t('ed.bookmarkPlaceholder')} />;
  return (
    <div className="ink-bookmark-wrap" contentEditable={false}>
      <div className="ink-bookmark" role="link" tabIndex={-1} onClick={() => window.open(url, '_blank')}>
        <div className="ink-bookmark-text">
          <div className="ink-bookmark-title">{bm?.title || url}</div>
          <div className="ink-bookmark-desc">{bm?.description}</div>
          <div className="ink-bookmark-url"><img src={resolveMedia(bm?.favicon || 'fixture://favicon')} alt="" width={16} height={16} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} /><span>{url}</span></div>
        </div>
        {bm?.image && <div className="ink-bookmark-img"><img src={resolveMedia(bm.image)} alt="" /></div>}
      </div>
      <Caption b={b} />
    </div>
  );
}
const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
