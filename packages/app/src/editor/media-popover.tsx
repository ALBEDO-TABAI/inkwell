/** Popover shown when clicking an empty image / video / bookmark / embed block: upload or paste a link. */
import { useRef, useState } from 'react';
import { t } from '../i18n';
import { store } from '../store/store';
import type { Block } from '../store/model';
import { openPopover, closePopover } from '../ui/overlay';

export type MediaKind = 'image' | 'video' | 'bookmark' | 'embed' | 'file' | 'audio' | 'pdf';
const UPLOADABLE: MediaKind[] = ['image', 'video', 'file', 'audio', 'pdf'];
const ACCEPT: Partial<Record<MediaKind, string>> = { image: 'image/*', video: 'video/*', audio: 'audio/*', pdf: 'application/pdf', file: '' };
const ID = 'media-popover';

function setProps(id: string, props: Record<string, unknown>) {
  store.transact('media', (tx) => tx.update(id, (b) => ({ props: { ...b.props, ...props } })));
}
function bookmarkFor(url: string) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return { title: host, description: '', url };
}
/** Open Graph lookup. In the desktop app the main process fetches the page (no CORS, no remote APIs); in a browser we keep the host-name card. */
export async function fetchOg(url: string): Promise<{ title: string; description: string; url: string; image?: string; favicon?: string } | null> {
  const n = (window as unknown as { inkwellNative?: { invoke?: (c: string, ...a: unknown[]) => Promise<unknown> } }).inkwellNative;
  if (!n?.invoke) return null;
  try { const r = await n.invoke('inkwell:fetch-og', url) as { title?: string; description?: string; image?: string; favicon?: string } | null; if (!r || !r.title) return null; return { title: r.title, description: r.description || '', url, image: r.image, favicon: r.favicon }; } catch { return null; }
}
export function normalizeUrl(s: string) {
  const v = s.trim();
  if (!v) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v;
}

export function openMediaPopover(b: Block, kind: MediaKind, anchor: DOMRect) {
  openPopover({ id: ID, anchor: { left: anchor.left + anchor.width / 2 - 270, right: anchor.right, top: anchor.top, bottom: anchor.bottom }, placement: 'bottom-start', offset: 4, className: 'ink-media-pop-wrap', render: (close) => <MediaPopover b={b} kind={kind} close={close} /> });
}

function MediaPopover({ b, kind, close }: { b: Block; kind: MediaKind; close: () => void }) {
  const tabs: ('upload' | 'link')[] = UPLOADABLE.includes(kind) ? ['upload', 'link'] : ['link'];
  const [tab, setTab] = useState(tabs[0]);
  const [v, setV] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (kind === 'embed') { if (!v.trim()) return; setProps(b.id, { html: v }); close(); return; }
    const url = normalizeUrl(v); if (!url) return;
    if (kind === 'bookmark') { setProps(b.id, { url, bookmark: bookmarkFor(url) }); void fetchOg(url).then((og) => { if (og) setProps(b.id, { bookmark: og }); }); }
    else if (kind === 'image') setProps(b.id, { src: url });
    else setProps(b.id, { url });
    close();
  };
  const onFile = (f?: File | null) => {
    if (!f) return;
    const r = new FileReader();
    if (f.size > 5 * 1024 * 1024) { alert(t('media.maxSize')); return; }
    r.onload = () => { setProps(b.id, kind === 'image' ? { src: String(r.result), fileName: f.name, fileSize: f.size } : { url: String(r.result), fileName: f.name, fileSize: f.size, mime: f.type }); closePopover(ID); };
    r.readAsDataURL(f);
  };
  const other = kind === 'file' || kind === 'audio' || kind === 'pdf';
  const ph = kind === 'image' ? t('media.pasteImage') : kind === 'video' ? t('media.pasteVideo') : kind === 'bookmark' ? t('media.pasteBookmark') : other ? t('media.pasteFile') : t('media.pasteHtml');
  const btn = kind === 'image' ? t('media.embedImage') : kind === 'video' ? t('media.embedVideo') : kind === 'bookmark' ? t('media.createBookmark') : kind === 'audio' ? t('media.embedAudio') : kind === 'pdf' ? t('media.embedPdf') : kind === 'file' ? t('media.embedFile') : t('media.embedHtml');
  const hint = kind === 'image' ? t('media.linkHint') : kind === 'video' ? t('media.videoHint') : kind === 'bookmark' ? t('media.bookmarkHint') : other ? t('media.fileHint') : t('media.htmlHint');
  return (
    <div className="ink-media-pop" onKeyDown={(e) => { if (e.key === 'Enter' && !(kind === 'embed' && !e.metaKey)) { e.preventDefault(); submit(); } }}>
      <div className="ink-media-tabs">
        {tabs.map((x) => <div key={x} role="tab" aria-selected={tab === x} className={'ink-media-tab' + (tab === x ? ' is-active' : '')} onClick={() => setTab(x)}>{x === 'upload' ? t('media.upload') : t('media.link')}</div>)}
      </div>
      <div className="ink-media-body">
        {tab === 'upload' ? (
          <>
            <button className="ink-btn ink-media-wide" onClick={() => file.current?.click()}>{t('media.chooseFile')}</button>
            <input ref={file} type="file" accept={ACCEPT[kind] || undefined} hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="ink-media-hint">{t('media.maxSize')}</div>
          </>
        ) : (
          <>
            {kind === 'embed'
              ? <textarea data-autofocus className="ink-input ink-media-input ink-media-textarea" placeholder={ph} value={v} onChange={(e) => setV(e.target.value)} />
              : <input data-autofocus className="ink-input ink-media-input" placeholder={ph} value={v} onChange={(e) => setV(e.target.value)} />}
            <button className="ink-btn ink-btn-primary ink-media-wide" onClick={submit} disabled={!v.trim()}>{btn}</button>
            <div className="ink-media-hint">{hint}</div>
          </>
        )}
      </div>
    </div>
  );
}
