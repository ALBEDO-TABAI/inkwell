/** Templates gallery: categories on the left, a card grid, a detail view with a live preview, and "使用模板". Templates are our own markdown. */
import { useMemo, useState } from 'react';
import { openPopover } from '../ui/overlay';
import { Icon, type IconName } from '../ui/icons';
import { t } from '../i18n';
import { parseMarkdown, type ParsedBlock } from '../editor/clipboard';
import { createFromParsed } from '../app/io';
import { navigate } from '../app/state';
import { toMarkdown } from '../editor/richtext';

export type Template = { id: string; cat: Cat; icon: string; title: string; desc: string; md: string; cover?: string };
type Cat = 'featured' | 'personal' | 'work' | 'school' | 'projects';
const CATS: { id: Cat | 'all'; icon: IconName }[] = [
  { id: 'all', icon: 'layoutGrid' as IconName }, { id: 'featured', icon: 'star2' }, { id: 'personal', icon: 'user' as IconName }, { id: 'work', icon: 'briefcase' as IconName }, { id: 'school', icon: 'bookOpen' }, { id: 'projects', icon: 'squareCheck' },
];

export const TEMPLATES: Template[] = [
  { id: 'weekly', cat: 'featured', icon: '🗓️', title: '每周计划', desc: '按天安排本周目标、待办与复盘。', cover: 'linear-gradient(135deg,#f6d365,#fda085)',
    md: `## 本周目标\n- [ ] 完成最重要的一件事\n- [ ] 运动三次\n- [ ] 读完一本书\n\n## 周一\n- [ ] \n## 周二\n- [ ] \n## 周三\n- [ ] \n## 周四\n- [ ] \n## 周五\n- [ ] \n\n---\n## 复盘\n> 这一周最有收获的是什么？\n` },
  { id: 'meeting', cat: 'work', icon: '📝', title: '会议记录', desc: '议程、讨论要点、决定与行动项。',
    md: `**日期：** \n**参会人：** \n\n## 议程\n1. \n2. \n\n## 讨论要点\n- \n\n## 决定\n- \n\n## 行动项\n- [ ] 负责人 · 截止日期\n` },
  { id: 'journal', cat: 'personal', icon: '📔', title: '日记', desc: '每天记录心情、感恩与想法。', cover: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
    md: `## 今天的心情\n😊 \n\n## 感恩的三件事\n1. \n2. \n3. \n\n## 今天学到了什么\n- \n\n## 明天想做的事\n- [ ] \n` },
  { id: 'reading', cat: 'personal', icon: '📚', title: '读书笔记', desc: '摘录、想法与行动，读完一本书就写一页。',
    md: `**作者：** \n**开始阅读：** \n\n## 一句话总结\n> \n\n## 关键观点\n- \n\n## 摘录\n> \n\n## 我会怎么用\n- [ ] \n` },
  { id: 'project', cat: 'projects', icon: '🚀', title: '项目简介', desc: '背景、目标、范围、里程碑与风险。', cover: 'linear-gradient(135deg,#84fab0,#8fd3f4)',
    md: `## 背景\n为什么要做这个项目？\n\n## 目标\n- \n\n## 范围\n| 包含 | 不包含 |\n| --- | --- |\n|  |  |\n\n## 里程碑\n- [ ] 方案评审\n- [ ] 第一版\n- [ ] 上线\n\n## 风险\n- \n` },
  { id: 'okr', cat: 'work', icon: '🎯', title: '季度 OKR', desc: '目标与关键结果，每周更新进度。',
    md: `## 目标 1\n- KR1：  · 进度 0%\n- KR2：  · 进度 0%\n\n## 目标 2\n- KR1：  · 进度 0%\n\n---\n## 每周更新\n- \n` },
  { id: 'lecture', cat: 'school', icon: '🎓', title: '课堂笔记', desc: '康奈尔式笔记：线索、笔记与总结。',
    md: `**课程：** \n**日期：** \n\n## 线索 / 问题\n- \n\n## 笔记\n- \n\n## 总结\n> \n` },
  { id: 'study', cat: 'school', icon: '🧠', title: '考试复习计划', desc: '按科目拆分复习任务与时间。', cover: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
    md: `## 考试日期\n\n## 复习清单\n- [ ] 第一章\n- [ ] 第二章\n- [ ] 第三章\n- [ ] 模拟考试\n\n## 错题本\n- \n` },
  { id: 'roadmap', cat: 'projects', icon: '🗺️', title: '产品路线图', desc: '现在、下一步、以后三栏规划。',
    md: `## 现在\n- [ ] \n\n## 下一步\n- [ ] \n\n## 以后\n- [ ] \n\n---\n> 每两周回顾一次路线图。\n` },
  { id: 'travel', cat: 'personal', icon: '✈️', title: '旅行计划', desc: '行程、预订、打包清单与预算。', cover: 'linear-gradient(135deg,#ffecd2,#fcb69f)',
    md: `## 行程\n### 第 1 天\n- \n### 第 2 天\n- \n\n## 预订\n- [ ] 机票\n- [ ] 酒店\n\n## 打包清单\n- [ ] 护照\n- [ ] 充电器\n- [ ] 换洗衣物\n\n## 预算\n| 项目 | 金额 |\n| --- | --- |\n| 交通 |  |\n| 住宿 |  |\n` },
  { id: 'onepager', cat: 'featured', icon: '📄', title: '一页纸方案', desc: '问题、方案、取舍，用一页说清楚。',
    md: `## 问题\n\n## 方案\n\n## 取舍\n- 优点：\n- 缺点：\n\n## 下一步\n- [ ] \n` },
  { id: 'habit', cat: 'featured', icon: '✅', title: '习惯打卡', desc: '每天勾选，坚持看得见。',
    md: `## 本月习惯\n- [ ] 早起\n- [ ] 喝 8 杯水\n- [ ] 冥想 10 分钟\n- [ ] 阅读 30 分钟\n\n> 不必完美，只需不中断两天。\n` },
];

export function openTemplates() {
  openPopover({ id: 'templates', anchor: { left: 0, top: 0, right: 0, bottom: 0 }, placement: 'center', modal: true, className: 'ink-tpl-pop', render: (close) => <Gallery close={close} /> });
}
export function applyTemplate(tp: Template, parent: string | 'private' = 'private') {
  const id = createFromParsed(tp.title, parseMarkdown(tp.md), parent, { page_icon: tp.icon, ...(tp.cover ? { page_cover: tp.cover } : {}) });
  navigate(id);
  return id;
}

function Gallery({ close }: { close: () => void }) {
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Template | null>(null);
  const list = useMemo(() => TEMPLATES.filter((x) => (cat === 'all' || x.cat === cat) && (!q.trim() || (x.title + x.desc).toLowerCase().includes(q.trim().toLowerCase()))), [cat, q]);
  return (
    <div className="ink-tpl" role="dialog" aria-label={t('tpl.title')} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (sel) setSel(null); else close(); } }}>
      <div className="ink-tpl-nav">
        <div className="ink-tpl-search"><Icon name="search" size={14} stroke={1.8} /><input data-autofocus placeholder={t('tpl.search')} value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} /></div>
        {CATS.map((c) => (
          <div key={c.id} role="button" data-cat={c.id} className={'ink-set-nav-item' + (cat === c.id && !sel ? ' is-active' : '')} onClick={() => { setCat(c.id); setSel(null); }}>
            <span className="ink-set-nav-icon"><Icon name={c.icon} size={16} stroke={1.7} /></span>{t(('tpl.cat.' + c.id) as 'tpl.cat.all')}
          </div>
        ))}
      </div>
      <div className="ink-tpl-main">
        <span className="ink-set-close" role="button" aria-label={t('common.close')} onClick={close}><Icon name="x" size={16} stroke={1.8} /></span>
        {sel ? <Detail tp={sel} back={() => setSel(null)} use={() => { close(); applyTemplate(sel); }} /> : (
          <div className="ink-tpl-body">
            <h1 className="ink-tpl-h1">{t(('tpl.cat.' + cat) as 'tpl.cat.all')}</h1>
            <p className="ink-tpl-sub">{t('tpl.sub')}</p>
            {list.length === 0 && <div className="ink-muted">{t('common.noResults')}</div>}
            <div className="ink-tpl-grid">
              {list.map((tp) => (
                <div key={tp.id} className="ink-tpl-card" role="button" data-tpl={tp.id} onClick={() => setSel(tp)}>
                  <div className="ink-tpl-thumb" style={tp.cover ? { background: tp.cover } : undefined}><Mini tp={tp} /></div>
                  <div className="ink-tpl-card-text"><div className="ink-tpl-card-title"><span>{tp.icon}</span>{tp.title}</div><div className="ink-tpl-card-desc">{tp.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Thumbnail: a tiny page sketch drawn from the template's own headings. */
function Mini({ tp }: { tp: Template }) {
  const heads = parseMarkdown(tp.md).filter((b) => b.type.startsWith('header') || b.type === 'sub_header' || b.type === 'to_do').slice(0, 5);
  return (
    <div className="ink-tpl-mini">
      <div className="ink-tpl-mini-icon">{tp.icon}</div>
      <div className="ink-tpl-mini-title">{tp.title}</div>
      {heads.map((b, i) => <div key={i} className={'ink-tpl-mini-line' + (b.type === 'to_do' ? ' is-todo' : '')}>{b.type === 'to_do' ? '☐ ' : ''}{toMarkdown(b.title) || '　'}</div>)}
    </div>
  );
}

function Detail({ tp, back, use }: { tp: Template; back: () => void; use: () => void }) {
  const blocks = parseMarkdown(tp.md);
  return (
    <div className="ink-tpl-detail">
      <div className="ink-tpl-detail-top">
        <span role="button" className="ink-tpl-back" onClick={back}><Icon name="chevronLeft" size={16} stroke={1.8} />{t('tpl.back')}</span>
      </div>
      <div className="ink-tpl-detail-cols">
        <div className="ink-tpl-preview">
          {tp.cover && <div className="ink-tpl-preview-cover" style={{ background: tp.cover }} />}
          <div className="ink-tpl-preview-page">
            <div className="ink-tpl-preview-icon">{tp.icon}</div>
            <h1>{tp.title}</h1>
            {blocks.map((b, i) => <PreviewBlock key={i} b={b} />)}
          </div>
        </div>
        <div className="ink-tpl-side">
          <div className="ink-tpl-side-title"><span>{tp.icon}</span>{tp.title}</div>
          <p className="ink-tpl-side-desc">{tp.desc}</p>
          <button className="ink-btn ink-btn-primary ink-tpl-use" data-testid="tpl-use" onClick={use}>{t('tpl.use')}</button>
          <div className="ink-tpl-side-meta"><div><span className="ink-muted">{t('tpl.category')}</span>{t(('tpl.cat.' + tp.cat) as 'tpl.cat.all')}</div><div><span className="ink-muted">{t('tpl.blocks')}</span>{blocks.length}</div></div>
        </div>
      </div>
    </div>
  );
}
function PreviewBlock({ b }: { b: ParsedBlock }) {
  const txt = toMarkdown(b.title).replace(/\*\*/g, '');
  switch (b.type) {
    case 'header': return <h2>{txt}</h2>;
    case 'sub_header': return <h3>{txt}</h3>;
    case 'sub_sub_header': return <h4>{txt}</h4>;
    case 'to_do': return <div className="ink-tpl-p"><span className="ink-tpl-box" />{txt}</div>;
    case 'bulleted_list': return <div className="ink-tpl-p">• {txt}</div>;
    case 'numbered_list': return <div className="ink-tpl-p">1. {txt}</div>;
    case 'quote': return <div className="ink-tpl-p ink-tpl-quote">{txt}</div>;
    case 'divider': return <hr />;
    case 'table': return <div className="ink-tpl-p ink-muted">▦ {t('tpl.table')}</div>;
    default: return <div className="ink-tpl-p">{txt}</div>;
  }
}
