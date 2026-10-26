/** Inkwell record model. Original design: a tree of blocks addressed by id. */

export type BlockType =
  | 'page' | 'text' | 'header' | 'sub_header' | 'sub_sub_header' | 'header_4'
  | 'bulleted_list' | 'numbered_list' | 'to_do' | 'toggle' | 'quote' | 'callout'
  | 'divider' | 'code' | 'equation' | 'column_list' | 'column'
  | 'image' | 'bookmark' | 'video' | 'table' | 'table_row' | 'table_of_contents'
  | 'breadcrumb' | 'alias' | 'synced' | 'collection_view_page';

/** Inline marks. Colours are editor colour keys: 'gray' | 'gray_background' etc. */
export interface Marks {
  b?: 1; i?: 1; u?: 1; s?: 1; code?: 1;
  color?: string;
  link?: string;
  /** inline equation source (segment text is '⁍') */
  eq?: string;
  /** mention (segment text is '‣') */
  mention?: { kind: 'page' | 'user' | 'date'; id?: string; value?: string };
}
export type Seg = [string, Marks?];
export type RichText = Seg[];

export interface BlockFormat {
  color?: string; // block colour: 'red' | 'red_background'
  page_icon?: string; // emoji or 'icon:<name>'
  page_cover?: string; // css background / image url
  page_cover_position?: number;
  page_font?: 'default' | 'serif' | 'mono';
  page_small_text?: boolean;
  page_full_width?: boolean;
  page_toc?: boolean; // floating outline on the right
  toggleable?: boolean; // toggle heading
  column_ratio?: number;
  code_wrap?: boolean;
  table_has_header?: boolean;
  table_widths?: number[];
  image_width?: number;
  image_aspect?: number;
  list_start?: number;
}

export interface Block {
  id: string;
  type: BlockType;
  title?: RichText;
  props?: {
    checked?: boolean;
    language?: string;
    caption?: RichText;
    expanded?: boolean;
    tex?: string;
    url?: string;
    src?: string;
    target?: string; // alias / synced target id
    cells?: RichText[]; // table_row
    bookmark?: { title: string; description: string; url: string; image?: string; favicon?: string };
    [k: string]: unknown;
  };
  format?: BlockFormat;
  content?: string[];
  parent: string;
  parentTable: 'block' | 'space';
  alive: boolean;
  created: number;
  edited: number;
  createdBy?: string;
  editedBy?: string;
}

export interface Space {
  id: string;
  name: string;
  icon: string; // a letter or emoji
  /** top-level page ids by section */
  teamspaces: { id: string; name: string; icon: string; pages: string[] }[];
  privatePages: string[];
  favorites: string[];
  trash: string[];
}

export interface User { id: string; name: string; email: string; avatar: string }

export const TEXT_LIKE: BlockType[] = ['text', 'header', 'sub_header', 'sub_sub_header', 'header_4', 'bulleted_list', 'numbered_list', 'to_do', 'toggle', 'quote', 'callout'];
export const HEADINGS: BlockType[] = ['header', 'sub_header', 'sub_sub_header', 'header_4'];
export const LIST_TYPES: BlockType[] = ['bulleted_list', 'numbered_list', 'to_do', 'toggle'];
/** blocks whose children render indented below their title */
export const CAN_HAVE_CHILDREN: BlockType[] = ['text', 'bulleted_list', 'numbered_list', 'to_do', 'toggle', 'quote', 'callout', 'header', 'sub_header', 'sub_sub_header', 'header_4', 'page', 'column_list', 'column', 'synced', 'table'];

export function isTextLike(t: BlockType) { return TEXT_LIKE.includes(t) || t === 'code'; }
export function plain(rt: RichText | undefined): string { return (rt || []).map((s) => s[0]).join(''); }

export const BLOCK_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type BlockColor = typeof BLOCK_COLORS[number];
