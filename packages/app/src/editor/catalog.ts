import type { BlockType } from '../store/model';
import type { IconName } from '../ui/icons';
import { t } from '../i18n';

export interface BlockKind {
  id: string;
  type: BlockType;
  label: () => string;
  icon: IconName;
  keywords: string[];
  hint?: string; // markdown shortcut shown at right
  toggleable?: boolean;
  /** creates something other than a plain type switch */
  special?: 'columns2' | 'columns3' | 'columns4' | 'page' | 'inlineEquation' | 'mentionPerson' | 'mentionPage' | 'date' | 'emoji' | 'linkToPage';
  turnInto?: boolean;
}

export const BLOCK_KINDS: BlockKind[] = [
  { id: 'text', type: 'text', label: () => t('b.text'), icon: 'text', keywords: ['text', 'plain', 'paragraph', 'wenben', '文本'], turnInto: true },
  { id: 'h1', type: 'header', label: () => t('b.h1'), icon: 'h1', keywords: ['h1', 'heading 1', 'title', 'biaoti', '#'], hint: '#', turnInto: true },
  { id: 'h2', type: 'sub_header', label: () => t('b.h2'), icon: 'h2', keywords: ['h2', 'heading 2', 'subtitle', '##'], hint: '##', turnInto: true },
  { id: 'h3', type: 'sub_sub_header', label: () => t('b.h3'), icon: 'h3', keywords: ['h3', 'heading 3', '###'], hint: '###', turnInto: true },
  { id: 'h4', type: 'header_4', label: () => t('b.h4'), icon: 'h4', keywords: ['h4', 'heading 4', '####'], hint: '####', turnInto: true },
  { id: 'bulleted', type: 'bulleted_list', label: () => t('b.bulleted'), icon: 'bullet', keywords: ['bulleted list', 'bullet', 'unordered', 'ul', '-'], hint: '-', turnInto: true },
  { id: 'numbered', type: 'numbered_list', label: () => t('b.numbered'), icon: 'numbered', keywords: ['numbered list', 'ordered', 'ol', '1.'], hint: '1.', turnInto: true },
  { id: 'todo', type: 'to_do', label: () => t('b.todo'), icon: 'todo', keywords: ['to-do list', 'todo', 'checkbox', 'task', '[]'], hint: '[]', turnInto: true },
  { id: 'toggle', type: 'toggle', label: () => t('b.toggle'), icon: 'toggle', keywords: ['toggle list', 'collapse', 'expand', '>'], hint: '>', turnInto: true },
  { id: 'page', type: 'page', label: () => t('b.page'), icon: 'page', keywords: ['page', 'subpage', 'yemian'], special: 'page', turnInto: true },
  { id: 'callout', type: 'callout', label: () => t('b.callout'), icon: 'callout', keywords: ['callout', 'note', 'tip', 'biaozhu'], turnInto: true },
  { id: 'quote', type: 'quote', label: () => t('b.quote'), icon: 'quote', keywords: ['quote', 'blockquote', 'citation', '"'], hint: '"', turnInto: true },
  { id: 'table', type: 'table', label: () => t('b.table'), icon: 'table', keywords: ['table', 'simple table', 'grid'] },
  { id: 'divider', type: 'divider', label: () => t('b.divider'), icon: 'divider', keywords: ['divider', 'separator', 'hr', 'line', '---'], hint: '---' },
  { id: 'linkToPage', type: 'alias', label: () => t('b.linkToPage'), icon: 'pageLink', keywords: ['link to page', 'alias', 'link'], special: 'linkToPage' },
  { id: 'image', type: 'image', label: () => t('b.image'), icon: 'image', keywords: ['image', 'picture', 'photo', 'img'] },
  { id: 'video', type: 'video', label: () => t('b.video'), icon: 'video', keywords: ['video', 'youtube', 'movie'] },
  { id: 'bookmark', type: 'bookmark', label: () => t('b.bookmark'), icon: 'bookmark', keywords: ['bookmark', 'web', 'url', 'link preview'] },
  { id: 'code', type: 'code', label: () => t('b.code'), icon: 'code', keywords: ['code', 'snippet', 'pre', '```'], hint: '```', turnInto: true },
  { id: 'equation', type: 'equation', label: () => t('b.equation'), icon: 'equation', keywords: ['block equation', 'math', 'latex', 'tex', 'formula', 'gongshi'], hint: '$$', turnInto: true },
  { id: 'synced', type: 'synced', label: () => t('b.synced'), icon: 'synced', keywords: ['synced block', 'sync', 'transclusion'], turnInto: true },
  { id: 'toc', type: 'table_of_contents', label: () => t('b.toc'), icon: 'toc', keywords: ['table of contents', 'toc', 'outline'] },
  { id: 'breadcrumb', type: 'breadcrumb', label: () => t('b.breadcrumb'), icon: 'breadcrumb', keywords: ['breadcrumb', 'path'] },
  { id: 'toggleH1', type: 'header', label: () => t('b.toggleH1'), icon: 'h1', keywords: ['toggle heading 1', 'toggle h1', '>#'], toggleable: true, hint: '>#', turnInto: true },
  { id: 'toggleH2', type: 'sub_header', label: () => t('b.toggleH2'), icon: 'h2', keywords: ['toggle heading 2', 'toggle h2', '>##'], toggleable: true, hint: '>##', turnInto: true },
  { id: 'toggleH3', type: 'sub_sub_header', label: () => t('b.toggleH3'), icon: 'h3', keywords: ['toggle heading 3', 'toggle h3', '>###'], toggleable: true, hint: '>###', turnInto: true },
  { id: 'toggleH4', type: 'header_4', label: () => t('b.toggleH4'), icon: 'h4', keywords: ['toggle heading 4', 'toggle h4'], toggleable: true, turnInto: true },
  { id: 'columns2', type: 'column_list', label: () => t('b.columns2'), icon: 'columns', keywords: ['2 columns', 'two columns', 'columns', 'layout'], special: 'columns2' },
  { id: 'columns3', type: 'column_list', label: () => t('b.columns3'), icon: 'columns3', keywords: ['3 columns', 'three columns', 'columns'], special: 'columns3' },
  { id: 'columns4', type: 'column_list', label: () => t('b.columns4'), icon: 'columns', keywords: ['4 columns', 'four columns'], special: 'columns4' },
  { id: 'mentionPerson', type: 'text', label: () => t('b.mentionPerson'), icon: 'at', keywords: ['mention person', 'person', 'user', '@'], special: 'mentionPerson' },
  { id: 'mentionPage', type: 'text', label: () => t('b.mentionPage'), icon: 'pageLink', keywords: ['mention page', 'page link', '[['], special: 'mentionPage' },
  { id: 'date', type: 'text', label: () => t('b.date'), icon: 'calendar', keywords: ['date', 'reminder', 'today', 'tomorrow', 'now'], special: 'date' },
  { id: 'emoji', type: 'text', label: () => t('b.emoji'), icon: 'smile', keywords: ['emoji', 'emoticon', ':'], special: 'emoji' },
  { id: 'inlineEquation', type: 'text', label: () => t('b.inlineEquation'), icon: 'sqrt', keywords: ['inline equation', 'inline math', '$'], special: 'inlineEquation' },
];
export const kind = (id: string) => BLOCK_KINDS.find((k) => k.id === id)!;

export const SLASH_SECTIONS: { id: string; label: () => string; items: string[] }[] = [
  { id: 'suggested', label: () => t('slash.suggested'), items: ['callout', 'code', 'page', 'toggle'] },
  { id: 'basic', label: () => t('slash.basic'), items: ['text', 'h1', 'h2', 'h3', 'h4', 'bulleted', 'numbered', 'todo', 'toggle', 'page', 'callout', 'quote', 'table', 'divider', 'linkToPage'] },
  { id: 'media', label: () => t('slash.media'), items: ['image', 'video', 'bookmark', 'code'] },
  { id: 'advanced', label: () => t('slash.advanced'), items: ['toc', 'equation', 'breadcrumb', 'synced', 'toggleH1', 'toggleH2', 'toggleH3', 'toggleH4'] },
  { id: 'inline', label: () => t('slash.inline'), items: ['mentionPerson', 'mentionPage', 'date', 'emoji', 'inlineEquation'] },
  { id: 'layout', label: () => t('slash.layout'), items: ['columns2', 'columns3', 'columns4'] },
];

export const TURN_INTO_ORDER = ['text', 'h1', 'h2', 'h3', 'h4', 'page', 'bulleted', 'numbered', 'todo', 'toggle', 'code', 'quote', 'callout', 'equation', 'synced', 'toggleH1', 'toggleH2', 'toggleH3', 'toggleH4'];

export function kindOfBlock(type: BlockType, toggleable?: boolean): BlockKind | undefined {
  return BLOCK_KINDS.find((k) => k.type === type && !!k.toggleable === !!toggleable && k.turnInto) || BLOCK_KINDS.find((k) => k.type === type);
}

export function matches(k: BlockKind, q: string): number {
  const s = q.trim().toLowerCase(); if (!s) return 1;
  const label = k.label().toLowerCase();
  if (label.startsWith(s)) return 3;
  if (label.includes(s)) return 2;
  if (k.keywords.some((w) => w.startsWith(s))) return 2;
  if (k.keywords.some((w) => w.includes(s))) return 1;
  return 0;
}
