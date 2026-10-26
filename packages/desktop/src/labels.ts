/** Native menu / dialog strings (zh-CN default, English fallback). Brand name is injected, never hard-coded. */
import { BRAND } from '@shared/brand';
const n = BRAND.name;
const ZH = {
  about: `关于 ${n}`, prefs: '首选项…', updates: '检查更新…', services: '服务', hide: `隐藏 ${n}`, hideOthers: '隐藏其他', unhide: '显示所有',
  quitNoTabs: '退出且不保存选项卡', quit: '退出',
  file: '文件', newTab: '新选项卡', newWindow: '新窗口', reopenTab: '重新打开上次关闭的选项卡', closeTab: '关闭选项卡', print: '正在打印…',
  edit: '编辑', undo: '撤消', redo: '重做', cut: '剪切', copy: '拷贝', copyLink: '拷贝当前页面链接', copyTitle: '拷贝当前页面名称',
  paste: '粘贴', pasteMatch: '粘贴和匹配样式', selectAll: '全选', speech: '语音', startSpeaking: '开始说话', stopSpeaking: '停止说话',
  view: '视图', reload: '重新加载', forceReload: '强制重新加载', devtools: '切换开发者工具', toggleSidebar: '显示/隐藏侧边栏',
  zoomIn: '放大', zoomOut: '缩小', zoomReset: '实际大小', fullscreen: '切换全屏',
  history: '历史', back: '返回', forward: '前进',
  window: '窗口', minimize: '最小化', zoom: '缩放', prevTab: '显示上一个选项卡', nextTab: '显示下一个选项卡', front: '前置全部窗口',
  help: '帮助', troubleshoot: '故障排除', showLogs: '在文件管理器中显示日志', showLogsMac: '在 Finder 中显示日志', openConsole: '打开控制台', openActivity: '打开活动监视器',
  blankTabDiag: '生成空白选项卡诊断…', blackScreen: '重启并诊断黑屏问题…', perfTrace: '记录性能跟踪', netLog: '录制网络日志…', mediaStatus: '扬声器和麦克风状态…',
  verboseLog: '启用高级日志记录并重新启动', latest: (os: string) => `打开 ${n} 的最新版本（${os} 版）`, mic: '麦克风', camera: '摄像头', resetData: '重置并删除所有本地数据', copyInstallId: '拷贝安装 ID',
  disableGpu: '禁用硬件加速并重新启动', openHelp: '打开帮助和文档',
  tabCloseOthers: '关闭其他选项卡', tabCloseRight: '关闭右侧选项卡', tabDuplicate: '复制选项卡', tabToWindow: '移至新窗口',
  resetConfirm: '这将删除此设备上的所有本地数据并重新启动。', resetOk: '重置并重新启动', cancel: '取消',
  aboutDetail: '一个本地优先的笔记与文档应用。',
  trayNewPage: '新建页面', trayQuickSearch: '快速搜索', trayShow: `显示 ${n}`, upToDate: (v: string) => `${n} ${v} 已是最新版本`, updateDetail: '这是本地构建版本，不会连接任何更新服务器。',
};
type L = typeof ZH;
const EN: L = {
  about: `About ${n}`, prefs: 'Preferences…', updates: 'Check for Updates…', services: 'Services', hide: `Hide ${n}`, hideOthers: 'Hide Others', unhide: 'Show All',
  quitNoTabs: 'Quit Without Saving Tabs', quit: 'Quit',
  file: 'File', newTab: 'New Tab', newWindow: 'New Window', reopenTab: 'Reopen Closed Tab', closeTab: 'Close Tab', print: 'Print…',
  edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', copyLink: 'Copy Link to Current Page', copyTitle: 'Copy Name of Current Page',
  paste: 'Paste', pasteMatch: 'Paste and Match Style', selectAll: 'Select All', speech: 'Speech', startSpeaking: 'Start Speaking', stopSpeaking: 'Stop Speaking',
  view: 'View', reload: 'Reload', forceReload: 'Force Reload', devtools: 'Toggle Developer Tools', toggleSidebar: 'Show/Hide Sidebar',
  zoomIn: 'Zoom In', zoomOut: 'Zoom Out', zoomReset: 'Actual Size', fullscreen: 'Toggle Full Screen',
  history: 'History', back: 'Back', forward: 'Forward',
  window: 'Window', minimize: 'Minimize', zoom: 'Zoom', prevTab: 'Show Previous Tab', nextTab: 'Show Next Tab', front: 'Bring All to Front',
  help: 'Help', troubleshoot: 'Troubleshooting', showLogs: 'Show Logs in File Manager', showLogsMac: 'Show Logs in Finder', openConsole: 'Open Console', openActivity: 'Open Activity Monitor',
  blankTabDiag: 'Generate Blank Tab Diagnostics…', blackScreen: 'Restart and Diagnose Black Screen…', perfTrace: 'Record Performance Trace', netLog: 'Record Network Log…', mediaStatus: 'Speaker and Microphone Status…',
  verboseLog: 'Enable Advanced Logging and Restart', latest: (os: string) => `Open the Latest Version of ${n} (${os})`, mic: 'Microphone', camera: 'Camera', resetData: 'Reset & Erase All Local Data', copyInstallId: 'Copy Install ID',
  disableGpu: 'Disable Hardware Acceleration and Restart', openHelp: 'Open Help & Documentation',
  tabCloseOthers: 'Close Other Tabs', tabCloseRight: 'Close Tabs to the Right', tabDuplicate: 'Duplicate Tab', tabToWindow: 'Move to New Window',
  resetConfirm: 'This deletes all local data on this device and restarts.', resetOk: 'Reset and Restart', cancel: 'Cancel',
  aboutDetail: 'A local-first notes and docs app.',
  trayNewPage: 'New Page', trayQuickSearch: 'Quick Search', trayShow: `Show ${n}`, upToDate: (v: string) => `${n} ${v} is up to date`, updateDetail: 'This is a local build; it never contacts an update server.',
};
const TW: L = { ...ZH,
  about: `關於 ${n}`, prefs: '偏好設定…', updates: '檢查更新…', hide: `隱藏 ${n}`, hideOthers: '隱藏其他', unhide: '顯示全部', quit: '結束', quitNoTabs: '結束且不儲存分頁',
  file: '檔案', newTab: '新分頁', newWindow: '新視窗', reopenTab: '重新開啟上次關閉的分頁', closeTab: '關閉分頁', print: '列印…',
  edit: '編輯', undo: '還原', redo: '重做', cut: '剪下', copy: '拷貝', copyLink: '拷貝目前頁面連結', copyTitle: '拷貝目前頁面名稱', paste: '貼上', pasteMatch: '貼上並符合樣式', selectAll: '全選',
  view: '顯示方式', reload: '重新載入', forceReload: '強制重新載入', devtools: '切換開發者工具', toggleSidebar: '顯示/隱藏側邊欄', zoomIn: '放大', zoomOut: '縮小', zoomReset: '實際大小', fullscreen: '切換全螢幕',
  history: '記錄', back: '返回', forward: '前進', window: '視窗', minimize: '縮到最小', zoom: '縮放', prevTab: '顯示上一個分頁', nextTab: '顯示下一個分頁', front: '將此程式所有視窗移至最前',
  help: '輔助說明', troubleshoot: '疑難排解', showLogs: '在檔案管理員中顯示記錄', showLogsMac: '在 Finder 中顯示記錄', resetData: '重設並刪除所有本機資料', copyInstallId: '拷貝安裝 ID',
  tabCloseOthers: '關閉其他分頁', tabCloseRight: '關閉右側分頁', tabDuplicate: '複製分頁', tabToWindow: '移至新視窗', cancel: '取消', resetOk: '重設並重新啟動', resetConfirm: '這將刪除此裝置上的所有本機資料並重新啟動。',
  aboutDetail: '一個本機優先的筆記與文件應用程式。', trayNewPage: '新增頁面', trayQuickSearch: '快速搜尋', trayShow: `顯示 ${n}`, upToDate: (v: string) => `${n} ${v} 已是最新版本`, updateDetail: '這是本機建置版本，不會連線到任何更新伺服器。',
};
export function labels(locale: string): L { return /^zh[-_](TW|HK|Hant)/i.test(locale) ? TW : /^zh/i.test(locale) ? ZH : EN; }
