import * as L from 'lucide-react';
import type { CSSProperties } from 'react';

/** Icon registry: open-source Lucide glyphs (ISC) plus a few original drawings. */
export type IconName = keyof typeof REG;
const REG = {
  home: L.House, chat: L.MessageCircle, calendar: L.CalendarDays, compose: L.SquarePen, inbox: L.Inbox,
  sidebar: L.PanelLeft, search: L.Search, library: L.LibraryBig, newChat: L.MessageCirclePlus,
  page: L.FileText, pageLink: L.FileSymlink, table: L.Table2, plus: L.Plus, more: L.Ellipsis,
  chevronRight: L.ChevronRight, chevronDown: L.ChevronDown, chevronLeft: L.ChevronLeft,
  star: L.Star, link: L.Link2, lock: L.Lock, smile: L.Smile, image: L.Image, grip: L.GripVertical,
  text: L.Type, h1: L.Heading1, h2: L.Heading2, h3: L.Heading3, h4: L.Heading4,
  bullet: L.List, numbered: L.ListOrdered, todo: L.ListTodo, toggle: L.ListCollapse, quote: L.Quote,
  callout: L.SquareMenu, divider: L.Minus, code: L.Code, equation: L.Sigma, columns: L.Columns2, columns3: L.Columns3,
  trash: L.Trash2, copy: L.Copy, duplicate: L.CopyPlus, move: L.CornerUpRight, rename: L.PencilLine, settings: L.Settings,
  users: L.Users, pencil: L.Pencil, bell: L.Bell, clock: L.Clock3, alarm: L.AlarmClock, check: L.Check, x: L.X,
  help: L.CircleHelp, apps: L.LayoutGrid, sliders: L.SlidersHorizontal, at: L.AtSign, comment: L.MessageSquareText,
  suggest: L.MessageSquareDiff, bold: L.Bold, italic: L.Italic, underline: L.Underline, strike: L.Strikethrough,
  clearFormat: L.RemoveFormatting, sqrt: L.Radical, arrowUpRight: L.ArrowUpRight, newWindow: L.AppWindow,
  sidePeek: L.PanelRight, download: L.CircleArrowDown, history: L.History, analytics: L.ChartNoAxesColumn,
  aa: L.ALargeSmall, ai: L.Sparkles, globe: L.Globe, mail: L.Mail, upgrade: L.CircleArrowUp, addUser: L.UserPlus,
  logout: L.LogOut, toc: L.TableOfContents, fullWidth: L.MoveHorizontal, smallText: L.AArrowDown, filter: L.ListFilter,
  shuffle: L.Shuffle, hand: L.Hand, leaf: L.Leaf, carrot: L.Carrot, ball: L.Volleyball, plane: L.Plane, bulb: L.Lightbulb,
  circleCheck: L.CircleCheck, flag: L.Flag, symbols: L.Shapes, wiki: L.BookOpen, bookmark: L.Bookmark, video: L.Video,
  synced: L.RefreshCcw, breadcrumb: L.ChevronsRight, tab: L.PanelTop, arrowLeft: L.ArrowLeft, arrowRight: L.ArrowRight,
  sun: L.Sun, moon: L.Moon, monitor: L.Monitor, keyboard: L.Keyboard, mic: L.Mic, embed: L.CodeXml, palette: L.Palette,
  turnInto: L.Repeat2, paintBucket: L.PaintBucket, file: L.File, info: L.Info, eye: L.Eye, user: L.User,
  emojiAdd: L.SmilePlus, commentAdd: L.MessageSquarePlus, upload: L.Upload, cornerDownLeft: L.CornerDownLeft,
};

export function Icon({ name, size = 20, stroke = 1.5, style, className }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  const C = REG[name] as L.LucideIcon;
  return <C size={size} strokeWidth={stroke} style={{ flexShrink: 0, display: 'block', ...style }} className={className} aria-hidden />;
}

/** Original page glyph used for pages without an icon (a folded-corner sheet). */
export function PageGlyph({ size = 20, link = false }: { size?: number; link?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <path d="M5.5 3.25h6l3.25 3.25v9.25a1 1 0 0 1-1 1h-8.25a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1z" />
      <path d="M11.25 3.4v3.35h3.35" />
      {link ? <path d="M9 14.5l4-4m0 0h-3m3 0v3" strokeLinecap="round" /> : <path d="M7.25 10.25h5.5M7.25 12.75h5.5" strokeLinecap="round" />}
    </svg>
  );
}

/** Our product mark: an ink drop inside a rounded square. Original artwork. */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor" />
      <path d="M12 5.5c2.6 3.3 4.2 5.7 4.2 7.9a4.2 4.2 0 1 1-8.4 0c0-2.2 1.6-4.6 4.2-7.9z" fill="var(--ink-background-primary, #fff)" />
    </svg>
  );
}
