/** Import / export. Markdown and HTML use the clipboard converters; PDF prints the page (Electron: printToPDF in the main process). */
import { store, newId } from '../store/store';
import type { Block } from '../store/model';
import { pageToMarkdown, parseMarkdown, htmlToBlocks, blocksToHtml, type ParsedBlock } from '../editor/clipboard';
import { pageTitle } from './pages';
import { navigate } from './state';
import { toast } from '../ui/toast';
import { escapeHtml } from '../editor/richtext';

const save = (data: BlobPart, type: string, name: string) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name.replace(/[\\/:*?"<>|]/g, '_'); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const native = () => (window as unknown as { inkwellNative?: { invoke?: (c: string, ...a: unknown[]) => Promise<unknown> } }).inkwellNative;

export function pageToHtml(pageId: string): string {
  const p = store.get(pageId)!; const title = escapeHtml(pageTitle(p));
  const icon = p.format?.page_icon && !p.format.page_icon.startsWith('icon:') ? `<div class="icon">${escapeHtml(p.format.page_icon)}</div>` : '';
  const body = blocksToHtml((p.content || []).filter((id) => store.get(id)?.alive !== false)).replace('<meta charset="utf-8">', '');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title><style>
body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;max-width:720px;margin:64px auto;padding:0 24px;color:#2c2c2b}
h1.title{font-size:40px;line-height:1.2;margin:0 0 24px}.icon{font-size:64px}blockquote{border-left:3px solid currentColor;margin:4px 0;padding:0 14px}
pre{background:#f6f5f4;padding:16px;border-radius:6px;overflow:auto}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}hr{border:0;border-top:1px solid #e5e3df}
table{border-collapse:collapse}td,th{border:1px solid #e5e3df;padding:6px 9px}
</style></head><body>${icon}<h1 class="title">${title}</h1>${body}</body></html>`;
}

export async function exportPage(pageId: string, kind: 'md' | 'html' | 'pdf') {
  const name = pageTitle(store.get(pageId)) || 'Untitled';
  if (kind === 'md') return save(pageToMarkdown(pageId), 'text/markdown', name + '.md');
  if (kind === 'html') return save(pageToHtml(pageId), 'text/html', name + '.html');
  const n = native();
  if (n?.invoke) { const r = await n.invoke('inkwell:print-pdf', { name: name + '.pdf' }) as { ok?: boolean; path?: string } | null; if (r?.ok) toast('已导出 PDF：' + r.path); return; }
  window.print();
}

function createFromParsed(title: string, parsed: ParsedBlock[], parent: string | 'private'): string {
  const id = newId();
  store.transact('import', (tx) => {
    const mk = (pb: ParsedBlock, par: string): string => {
      const bid = newId(); const kids = pb.children.map((c) => mk(c, bid));
      tx.create({ id: bid, type: pb.type, title: pb.title, props: pb.props, format: pb.format, parent: par, parentTable: 'block', content: kids, alive: true, created: Date.now(), edited: Date.now() } as Block);
      return bid;
    };
    const kids = parsed.map((pb) => mk(pb, id));
    if (parent === 'private') {
      tx.create({ id, type: 'page', title: [[title]], parent: store.space.id, parentTable: 'space', content: kids, alive: true, created: Date.now(), edited: Date.now() });
      tx.space((s) => ({ ...s, privatePages: [...s.privatePages, id] }));
    } else { tx.create({ id, type: 'page', title: [[title]], parent, parentTable: 'block', content: kids, alive: true, created: Date.now(), edited: Date.now() }); tx.insertChild(parent, id); }
  });
  return id;
}

/** Import .md / .markdown / .txt / .html files as new private pages. A leading "# Title" becomes the page title. */
export async function importFiles(files: FileList | File[], parent: string | 'private' = 'private'): Promise<string[]> {
  const ids: string[] = [];
  for (const f of Array.from(files)) {
    const text = await f.text(); const base = f.name.replace(/\.(md|markdown|txt|html?)$/i, '');
    if (/\.html?$/i.test(f.name)) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const h1 = doc.querySelector('h1'); const title = (doc.title || h1?.textContent || base).trim();
      if (h1 && h1.textContent?.trim() === title) h1.remove();
      doc.querySelectorAll('style,script,meta,title').forEach((n) => n.remove());
      ids.push(createFromParsed(title, htmlToBlocks(doc.body.innerHTML), parent));
    } else {
      let src = text; let title = base;
      const m = src.match(/^\s*#\s+(.+)\n/); if (m) { title = m[1].trim(); src = src.slice(m[0].length); }
      ids.push(createFromParsed(title, parseMarkdown(src), parent));
    }
  }
  if (ids.length) { toast(`已导入 ${ids.length} 个页面`); navigate(ids[ids.length - 1]); }
  return ids;
}
export function pickAndImport(parent: string | 'private' = 'private') {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.md,.markdown,.txt,.html,.htm,text/markdown,text/html,text/plain';
  inp.onchange = () => { if (inp.files?.length) void importFiles(inp.files, parent); };
  inp.click();
}
/** Whole-workspace JSON backup (re-importable by a future version). */
export function exportWorkspace() {
  save(JSON.stringify({ format: 'inkwell-backup', version: 1, exported: new Date().toISOString(), space: store.space, blocks: [...store.blocks.values()] }, null, 1), 'application/json', 'workspace-backup.json');
}
