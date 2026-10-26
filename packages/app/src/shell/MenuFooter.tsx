import { t } from '../i18n';
import { store } from '../store/store';
import type { Block } from '../store/model';
import { countWords } from '../app/pages';

export function formatEdited(ts: number): string {
  const d = new Date(ts), now = new Date();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return `${t('common.today')} ${hm}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `${t('common.yesterday')} ${hm}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

export function Avatar({ size = 16 }: { size?: number }) {
  const u = store.users.get(store.currentUser);
  return <span className="ink-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{u?.avatar || '?'}</span>;
}

export function EditedFooter({ block, counts }: { block?: Block; counts?: 'words' | 'chars' }) {
  const u = store.users.get(block?.editedBy || store.currentUser);
  let extra: string | undefined;
  if (block && counts) {
    const c = countWords(block.id);
    extra = counts === 'words' ? t('common.wordsChars', { words: c.words, chars: c.chars }) : t('common.chars', { chars: c.chars });
  }
  return (
    <div className="ink-edited-footer">
      <div className="ink-edited-label">{t('common.lastEdited')}</div>
      <div className="ink-edited-user"><Avatar /><span>{u?.name}</span></div>
      <div className="ink-edited-line">{formatEdited(block?.edited || Date.now())}</div>
      {extra && <div className="ink-edited-line">{extra}</div>}
    </div>
  );
}
