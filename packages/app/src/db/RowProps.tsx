/** Property list shown under the title of a database row page (full page and peeks), plus the comments stub and the blank-page hint. */
import type { Block } from '../store/model';
import { store } from '../store/store';
import { Icon } from '../ui/icons';
import { schemaOf, viewsOf, rawValue, isEmpty, setValue, addProp, type Prop } from './model';
import { CellValue, PropIcon, Avatar } from './cells';
import { openCellEditor } from './editors';
import { openHeaderMenu } from './menus';
import { openMenu } from '../ui/menu';
import { PROP_ICON } from './cells';
import { PageComments } from '../comments/Comments';

const TYPE_LIST: [Prop['type'], string][] = [['text', '文本'], ['number', '数字'], ['select', '选择'], ['multi_select', '多选'], ['status', '状态'], ['date', '日期'], ['person', '人员'], ['checkbox', '复选框'], ['url', '网址'], ['email', '电子邮件'], ['phone_number', '电话'], ['formula', '函数'], ['created_time', '创建时间']];
void PROP_ICON;

export function RowProps({ row, db, locked }: { row: Block; db: Block; locked?: boolean }) {
  const s = schemaOf(db);
  const ids = Object.keys(s).filter((k) => k !== 'title').sort((a, b) => s[a].name.localeCompare(s[b].name, 'en'));
  const view = viewsOf(db)[0];
  return (
    <div className="ink-rowprops" contentEditable={false}>
      {ids.map((id) => {
        const p = s[id]; const v = rawValue(row, id, db);
        const ro = locked || p.type === 'formula' || p.type === 'created_time';
        return (
          <div key={id} className="ink-rowprop" data-prop={id}>
            <div className="ink-rowprop-label" role="button" onClick={(e) => view && !locked && openHeaderMenu(e.currentTarget, db, view, id)}>
              <PropIcon type={p.type} /><span>{p.name}</span>
            </div>
            <div className={'ink-rowprop-value' + (ro ? ' is-ro' : '')} role="button"
              onClick={(e) => { if (ro) return; if (p.type === 'checkbox') { setValue(row.id, id, !v); return; } openCellEditor(e.currentTarget, row.id, id, db, { minWidth: 300 }); }}>
              {isEmpty(v) && p.type !== 'checkbox' ? <span className="ink-rowprop-empty">空</span> : <CellValue row={row} propId={id} db={db} wrap />}
            </div>
          </div>
        );
      })}
      {!locked && <div className="ink-rowprop-add" role="button" onClick={(e) => openMenu(e.currentTarget.getBoundingClientRect(), { width: 265, search: '搜索属性类型…', groups: [TYPE_LIST.map(([t, label]) => ({ id: t, label, text: label, icon: <PropIcon type={t} />, onSelect: () => addProp(db.id, t) }))] })}>
        <Icon name="plus" size={16} /><span>Add a property</span>
      </div>}
      <div className="ink-rowcomments">
        <div className="ink-rowcomments-title">评论</div>
        <PageComments pageId={row.id} always />
      </div>
    </div>
  );
}
