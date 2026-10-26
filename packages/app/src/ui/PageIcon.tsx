import type { Block } from '../store/model';
import { store } from '../store/store';
import { Icon, PageGlyph, type IconName } from './icons';

/** Icon for a page-like block: emoji, a named glyph ('icon:x'), or the default sheet. */
export function PageIcon({ block, size = 20, emojiSize }: { block?: Block; size?: number; emojiSize?: number }) {
  if (!block) return <PageGlyph size={size} />;
  if (block.type === 'alias') {
    const target = store.get(block.props?.target);
    return (
      <span className="ink-alias-icon" style={{ width: size, height: size }}>
        <PageIcon block={target} size={size} emojiSize={emojiSize} />
        <svg className="ink-alias-arrow" width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" aria-hidden>
          <path d="M3 9L9 3M9 3H4.5M9 3v4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  const ic = block.format?.page_icon;
  if (block.type === 'collection_view_page' && !ic) return <Icon name="table" size={size} stroke={1.4} />;
  if (!ic) return <PageGlyph size={size} />;
  if (ic.startsWith('icon:')) return <Icon name={ic.slice(5) as IconName} size={size} stroke={1.6} />;
  return <span className="ink-emoji" style={{ fontSize: emojiSize ?? Math.round(size * 0.8), lineHeight: 1, width: size, height: size }}>{ic}</span>;
}
