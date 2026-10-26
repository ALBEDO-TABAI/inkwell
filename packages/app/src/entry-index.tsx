import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import '@tokens/tokens.css';
import './styles/app.css';
import { initPersistence, kv } from './store/persistence';
import { initUi } from './app/state';
import { App } from './App';
import { getLocale } from './i18n';
import { store } from './store/store';
import { getUi, setUi, navigate } from './app/state';
import { editables, focusBlock } from './editor/registry';

async function boot() {
  document.documentElement.lang = getLocale();
  const q = new URLSearchParams(location.search);
  if (q.get('harness') === '1') document.documentElement.classList.add('is-harness');
  await initPersistence();
  if (q.get('promo') === '1') kv.promoDismissed = false;
  if (q.has('expand')) kv.sidebarExpanded = Object.fromEntries(q.get('expand')!.split(',').filter(Boolean).map((id) => [id, true]));
  initUi();
  createRoot(document.getElementById('root')!).render(<App />);
  if (q.get('harness') === '1') (window as any).__ink = { store, getUi, setUi, navigate, editables, focusBlock };
  (window as any).__inkwellReady = true;
}
boot();
