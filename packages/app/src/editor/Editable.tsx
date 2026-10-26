import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import type { Block, RichText } from '../store/model';
import { store } from '../store/store';
import { toHtml, fromDom, rtPlain, normalize } from './richtext';
import { inlineCtx } from './render-inline';
import { registerEditable } from './registry';
import { getSelectionOffsets, setSelectionOffsets } from './caret';
import { setTitle } from './commands';
import { handleKeyDown } from './keyboard';
import { afterInput } from './input-rules';
import { handlePaste, handleCopy, handleCut } from './clipboard';
import { highlightCode } from './code';
import { onSelectionChanged } from './inline-toolbar';

/** true inside a locked page: editables become read-only */
export const LockContext = createContext(false);

interface Props {
  block: Block;
  className?: string;
  placeholder?: string;
  /** show placeholder even when not focused */
  alwaysPlaceholder?: boolean;
  tag?: 'div' | 'h2' | 'h3' | 'h4';
  code?: boolean;
  /** edit a different field than title (e.g. table cell) */
  value?: RichText;
  onChange?: (rt: RichText) => void;
  plainOnly?: boolean;
}

function sameRt(a: RichText | undefined, b: RichText | undefined) { return JSON.stringify(normalize(a || [])) === JSON.stringify(normalize(b || [])); }

export function Editable({ block, className, placeholder, alwaysPlaceholder, tag = 'div', code, value, onChange, plainOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const title = value ?? block.title;
  const lastRendered = useRef<string>('');
  const lang = block.props?.language;

  const render = (el: HTMLElement, rt: RichText | undefined, keepCaret: boolean) => {
    const sel = keepCaret && document.activeElement === el ? getSelectionOffsets(el) : null;
    const html = code ? highlightCode(rtPlain(rt), lang || 'plain') : toHtml(rt, inlineCtx);
    if (el.innerHTML !== html) el.innerHTML = html;
    lastRendered.current = JSON.stringify(normalize(rt || []));
    if (sel) setSelectionOffsets(el, sel.start, sel.end);
    el.classList.toggle('is-empty', !rtPlain(rt).length);
  };

  useLayoutEffect(() => {
    const el = ref.current!;
    if (JSON.stringify(normalize(title || [])) !== lastRendered.current || code) {
      if (composing.current) return;
      // skip re-render when DOM already represents the value (typing)
      const domVal = code ? [[el.textContent || '']] as RichText : fromDom(el);
      if (!sameRt(domVal, title) || !el.childNodes.length && rtPlain(title).length || code) render(el, title, true);
      else { lastRendered.current = JSON.stringify(normalize(title || [])); el.classList.toggle('is-empty', !rtPlain(title).length); }
    }
  });
  // Register on every commit: the element can be recreated when the tag changes (e.g. text → heading).
  const registered = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (value !== undefined) return;
    const el = ref.current;
    if (el && registered.current !== el) {
      const was = registered.current && document.activeElement === registered.current;
      registerEditable(block.id, el, registered.current);
      registered.current = el;
      if (was) el.focus({ preventScroll: true });
    }
  });
  useLayoutEffect(() => () => { if (value === undefined) registerEditable(block.id, null, registered.current); }, [block.id]);
  useEffect(() => { if (code) render(ref.current!, title, true); }, [lang]);

  const commit = () => {
    const el = ref.current!;
    let rt: RichText = code ? (el.textContent ? [[el.textContent.replace(/\u200b/g, '')]] : []) : fromDom(el);
    if (plainOnly) rt = rtPlain(rt) ? [[rtPlain(rt)]] : [];
    const sel = getSelectionOffsets(el);
    el.classList.toggle('is-empty', !rtPlain(rt).length);
    if (sameRt(rt, title)) return;
    lastRendered.current = JSON.stringify(normalize(rt));
    if (onChange) onChange(rt);
    else setTitle(block.id, rt, true, sel ? { start: sel.start, end: sel.end } : undefined);
    if (code) render(el, rt, true);
    if (!onChange && sel) afterInput(block.id, el, sel.start);
  };

  const Tag = tag as any;
  const locked = useContext(LockContext);
  return (
    <Tag
      ref={ref}
      className={'ink-editable' + (className ? ' ' + className : '') + (alwaysPlaceholder ? ' show-ph' : '')}
      contentEditable={!locked}
      suppressContentEditableWarning
      spellCheck
      data-editable-id={value === undefined ? block.id : undefined}
      data-placeholder={placeholder}
      role="textbox"
      onInput={() => { if (!composing.current) commit(); }}
      onCompositionStart={() => (composing.current = true)}
      onCompositionEnd={() => { composing.current = false; commit(); }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => { if (!composing.current && !e.nativeEvent.isComposing) handleKeyDown(e, block.id, ref.current!, { code: !!code, cell: value !== undefined }); }}
      onPaste={(e: React.ClipboardEvent) => handlePaste(e, block.id, ref.current!, { code: !!code, cell: value !== undefined, onChange })}
      onCopy={(e: React.ClipboardEvent) => handleCopy(e)}
      onCut={(e: React.ClipboardEvent) => handleCut(e, block.id, ref.current!)}
      onMouseUp={() => setTimeout(() => onSelectionChanged(), 0)}
      onKeyUp={(e: React.KeyboardEvent) => { if (e.shiftKey || e.key.startsWith('Arrow')) onSelectionChanged(); }}
      onFocus={() => store.sealUndo()}
    />
  );
}
