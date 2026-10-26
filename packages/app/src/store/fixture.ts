/**
 * Fixture database mirroring the reference test workspace ("REA 參考頁" + "REA DB").
 * Content transcribed from the reference screenshots (B01–B08, logs/db_baseline.txt).
 */
import type { Block, BlockType, RichText, Space, User, Marks, BlockFormat } from './model';

const T0 = Date.UTC(2026, 9, 26, 7, 25); // 2026-10-26 16:25 JST

export interface FixtureData { blocks: Block[]; space: Space; users: User[]; kv: Record<string, unknown> }

export function buildFixture(): FixtureData {
  const blocks: Block[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${(++n).toString().padStart(3, '0')}`;
  const mk = (type: BlockType, parent: string, title?: RichText, extra: Partial<Block> = {}): Block => {
    const b: Block = { id: extra.id || id(type), type, title, parent, parentTable: 'block', alive: true, created: T0, edited: T0, createdBy: 'user-1', editedBy: 'user-1', content: [], ...extra };
    blocks.push(b);
    const p = blocks.find((x) => x.id === parent);
    if (p) (p.content ||= []).push(b.id);
    return b;
  };
  const r = (s: string, m?: Marks): RichText => [m ? [s, m] : [s]];
  const fmt = (f: BlockFormat) => ({ format: f });

  // ---- pages
  const root = mk('page', 'space-1', r('REA 參考頁'), { id: 'page-rea', parentTable: 'space', format: { page_toc: true } });
  const P = root.id;
  mk('table_of_contents', P);
  mk('text', P, [
    ['This is a plain paragraph of body text used as a typography reference. It has '],
    ['bold', { b: 1 }], [', '], ['italic', { i: 1 }], [', '], ['strikethrough', { s: 1 }], [', '],
    ['inline code', { code: 1 }], [', and a '], ['link to Wikipedia', { link: 'https://www.wikipedia.org' }],
    [' so that every inline style appears on one line.'],
  ]);
  mk('header', P, r('Heading 1 sample'));
  mk('sub_header', P, r('Heading 2 sample'));
  mk('sub_sub_header', P, r('Heading 3 sample'));
  const b1 = mk('bulleted_list', P, r('Bulleted item level 1'));
  const b2 = mk('bulleted_list', b1.id, r('Bulleted item level 2'));
  mk('bulleted_list', b2.id, r('Bulleted item level 3'));
  mk('bulleted_list', b1.id, r('Second level 2 item'));
  mk('bulleted_list', P, r('Another level 1 item'));
  const n1 = mk('numbered_list', P, r('Numbered item one'));
  const n2 = mk('numbered_list', n1.id, r('Nested numbered a'));
  mk('numbered_list', n2.id, r('Nested numbered i'));
  mk('numbered_list', P, r('Numbered item two'));
  mk('numbered_list', P, r('Numbered item three'));
  mk('to_do', P, r('Completed to-do item'), { props: { checked: true } });
  mk('to_do', P, r('Open to-do item'), { props: { checked: false } });
  mk('to_do', P, r('Another open to-do'), { props: { checked: false } });
  mk('quote', P, r('A quote block: simplicity is the ultimate sophistication.'));
  mk('divider', P);
  mk('code', P, r('// JavaScript code block\nfunction greet(name) {\n  const msg = `Hello, ${name}!`;\n  return msg.toUpperCase();\n}\nconsole.log(greet("REA"));'), { props: { language: 'javascript' } });
  const tbl = mk('table', P, undefined, fmt({ table_has_header: true, table_widths: [120, 120, 120] }));
  for (const row of [['Name', 'Role', 'Score'], ['Alice', 'Design', '92'], ['Bob', 'Engineering', '87'], ['Chen', 'Research', '95']]) {
    mk('table_row', tbl.id, undefined, { props: { cells: row.map((c) => r(c)) } });
  }
  mk('text', P, r('Text colors line follows.'));
  const tg1 = mk('toggle', P, r('Toggle (open)'), { props: { expanded: true } });
  mk('text', tg1.id, r('Hidden child text'));
  const tg2 = mk('toggle', P, r('Toggle (closed)'), { props: { expanded: false } });
  mk('text', tg2.id, r('Inside closed toggle'));
  const th = mk('sub_header', P, r('Toggle heading 2'), { format: { toggleable: true }, props: { expanded: true } });
  mk('text', th.id, r('Child paragraph under toggle heading.'));
  mk('callout', P, r('Callout block: a highlighted note.'), { format: { page_icon: '💡' } });
  mk('equation', P, undefined, { props: { tex: 'E = mc^2' } });
  const cl2 = mk('column_list', P);
  const c21 = mk('column', cl2.id, undefined, fmt({ column_ratio: 0.5 }));
  mk('text', c21.id, r('Left column'));
  const c22 = mk('column', cl2.id, undefined, fmt({ column_ratio: 0.5 }));
  mk('text', c22.id, r('Right column'));
  const cl3 = mk('column_list', P);
  for (const label of ['Col A', 'Col B', 'Col C']) {
    const c = mk('column', cl3.id, undefined, fmt({ column_ratio: 1 / 3 }));
    mk('text', c.id, r(label));
  }
  mk('image', P, undefined, { props: { src: 'fixture://landscape' }, format: { image_aspect: 316.06 / 704 } });
  mk('bookmark', P, undefined, { props: { url: 'https://www.wikipedia.org', bookmark: { title: 'Wikipedia, the free encyclopedia', description: 'Wikipedia is a free online encyclopedia, created and edited by volunteers around the world and hosted by the Wikimedia Foundation.', url: 'https://www.wikipedia.org' } } });
  mk('video', P, undefined, { props: { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }, format: { image_aspect: 396.61 / 704 } });
  mk('breadcrumb', P);
  mk('sub_sub_header', P, r('Colors'));
  const names = ['Default', 'Gray', 'Brown', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Red'];
  for (const nm of names) mk('text', P, r(`Text color ${nm}`), nm === 'Default' ? {} : { format: { color: nm.toLowerCase() } });
  for (const nm of names) mk('text', P, r(`Background ${nm}`), nm === 'Default' ? {} : { format: { color: nm.toLowerCase() + '_background' } });
  mk('text', P, [['Mentions: '], ['‣', { mention: { kind: 'date', value: '2026-10-26' } }], [' and a person mention '], ['‣', { mention: { kind: 'user', id: 'user-1' } }]]);
  const L1 = mk('page', P, r('REA 子頁 L1'), { id: 'page-l1', format: { page_icon: '📗', page_cover: 'fixture://cover-1' } });
  mk('text', L1.id, r('Level 1 page'));
  const L2 = mk('page', L1.id, r('REA 子頁 L2'), { id: 'page-l2', format: { page_icon: '📘' } });
  mk('text', L2.id, r('Level 2 page'));
  const L3 = mk('page', L2.id, r('REA 子頁 L3'), { id: 'page-l3' });
  mk('text', L3.id, r('Level 3 page'));
  mk('alias', P, undefined, { props: { target: L2.id } });
  const sy = mk('synced', P);
  mk('text', sy.id, r('Synced content'));
  const db = mk('collection_view_page', P, r('REA DB'), { id: 'page-db' });
  buildDb(db, mk, r);

  // other private pages
  const welcome = mk('page', 'space-1', r('从移动端开始吧'), { id: 'page-mobile', parentTable: 'space', format: { page_icon: '👋' } });
  mk('text', welcome.id, r('在手机上安装应用，随时随地记录想法。'));
  const sketch = mk('page', 'space-1', r('速写板'), { id: 'page-sketch', parentTable: 'space', format: { page_icon: 'icon:pencil' } });
  mk('text', sketch.id, []);
  const oneone = mk('page', 'space-1', r('一对一会议记录'), { id: 'page-1on1', parentTable: 'space', format: { page_icon: 'icon:users' } });
  mk('text', oneone.id, []);
  const hq = mk('page', 'space-1', r('老 贰哔’s Space 总部'), { id: 'page-hq', parentTable: 'space', format: { page_icon: 'icon:home' } });
  mk('text', hq.id, []);

  const space: Space = {
    id: 'space-1', name: '老 贰哔’s Space', icon: '老',
    teamspaces: [{ id: 'ts-1', name: '老 贰哔’s Space 总部', icon: 'icon:home', pages: [hq.id] }],
    privatePages: [P, welcome.id, sketch.id, oneone.id],
    favorites: [], trash: [],
  };
  const users: User[] = [{ id: 'user-1', name: '老 贰哔', email: 'bai@example.com', avatar: '贰哔' }];
  return {
    blocks, space, users,
    kv: { sidebarExpanded: { [P]: true }, recentPages: [P, L1.id, L2.id] },
  };
}

/** REA DB: 14 properties, 12 rows (db_baseline.txt). Rendering arrives in M4; data is complete now. */
function buildDb(db: Block, mk: (t: BlockType, p: string, title?: RichText, extra?: Partial<Block>) => Block, r: (s: string) => RichText) {
  const rows = [
    ['Draft the first concept.', 10, 'Alpha', ['red'], '未开始', ['2026-10-05', '2026-10-08'], true, false],
    ['Review the layout.', 20, 'Beta', ['green', 'blue'], '进行中', ['2026-10-12', '2026-10-17'], false, true],
    ['Approve the color palette.', 30, 'Gamma', ['blue'], '完成', ['2026-10-15', '2026-10-17'], true, false],
    ['Refine the navigation.', 40, 'Alpha', ['red', 'green'], '未开始', ['2026-10-20', '2026-10-24'], false, false],
    ['Compare card styles.', 50, 'Beta', ['green'], '进行中', ['2026-10-26'], true, true],
    ['Finish the icon set.', 60, 'Gamma', ['blue', 'red'], '完成', ['2026-10-28', '2026-11-02'], false, false],
    ['Explore mobile spacing.', 70, 'Alpha', ['red'], '未开始', ['2026-11-03', '2026-11-06'], true, false],
    ['Test the filter menu.', 80, 'Beta', ['green', 'blue'], '进行中', ['2026-11-09'], false, true],
    ['Finalize the empty state.', 90, 'Gamma', ['blue'], '完成', ['2026-11-12', '2026-11-14'], true, false],
    ['Check keyboard flows.', 100, 'Alpha', ['red', 'green'], '未开始', ['2026-11-17', '2026-11-21'], false, false],
    ['Review the timeline.', 110, 'Beta', ['green'], '进行中', ['2026-11-24'], true, true],
    ['Complete the design review.', 120, 'Gamma', ['blue', 'red'], '完成', ['2026-11-26', '2026-11-30'], false, false],
  ] as const;
  db.props = {
    schema: {
      title: { name: 'Name', type: 'title' }, notes: { name: 'Notes', type: 'text' }, score: { name: 'Score', type: 'number' },
      category: { name: 'Category', type: 'select', options: [{ v: 'Alpha', c: 'brown' }, { v: 'Beta', c: 'default' }, { v: 'Gamma', c: 'green' }] },
      tags: { name: 'Tags', type: 'multi_select', options: [{ v: 'red', c: 'brown' }, { v: 'green', c: 'yellow' }, { v: 'blue', c: 'purple' }] },
      status: { name: 'Status', type: 'status', options: [{ v: '未开始', c: 'default' }, { v: '进行中', c: 'blue' }, { v: '完成', c: 'green' }] },
      due: { name: 'Due', type: 'date' }, owner: { name: 'Owner', type: 'person' }, done: { name: 'Done?', type: 'checkbox' },
      website: { name: 'Website', type: 'url' }, email: { name: 'Email', type: 'email' }, phone: { name: 'Phone', type: 'phone_number' },
      double: { name: 'Double', type: 'formula', formula: 'prop("Score") * 2' }, created: { name: 'Created', type: 'created_time' },
    },
    views: ['Table', 'Board', 'List', 'Gallery', 'Calendar', 'Timeline'].map((v, i) => ({ id: `view-${i}`, name: v, type: v.toLowerCase() })),
  };
  rows.forEach((row, i) => {
    const k = i + 1;
    mk('page', db.id, r(`Task ${String(k).padStart(2, '0')}`), {
      id: `row-${String(k).padStart(2, '0')}`,
      props: {
        notes: row[0], score: row[1], category: row[2], tags: [...row[3]], status: row[4], due: [...row[5]],
        owner: row[6] ? ['user-1'] : [], done: row[7], website: `https://example.com/${k}`, email: `test${k}@example.com`, phone: `555-01${String(k).padStart(2, '0')}`,
      },
    });
  });
}
