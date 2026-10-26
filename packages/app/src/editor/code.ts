import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-yaml';
import { escapeHtml } from './richtext';

export const LANGUAGES: { id: string; label: string; prism?: string }[] = [
  { id: 'plain', label: 'Plain Text' }, { id: 'javascript', label: 'JavaScript', prism: 'javascript' }, { id: 'typescript', label: 'TypeScript', prism: 'typescript' },
  { id: 'jsx', label: 'JSX', prism: 'jsx' }, { id: 'tsx', label: 'TSX', prism: 'tsx' }, { id: 'json', label: 'JSON', prism: 'json' }, { id: 'html', label: 'HTML', prism: 'markup' },
  { id: 'css', label: 'CSS', prism: 'css' }, { id: 'python', label: 'Python', prism: 'python' }, { id: 'bash', label: 'Shell', prism: 'bash' }, { id: 'markdown', label: 'Markdown', prism: 'markdown' },
  { id: 'sql', label: 'SQL', prism: 'sql' }, { id: 'go', label: 'Go', prism: 'go' }, { id: 'rust', label: 'Rust', prism: 'rust' }, { id: 'java', label: 'Java', prism: 'java' },
  { id: 'c', label: 'C', prism: 'c' }, { id: 'cpp', label: 'C++', prism: 'cpp' }, { id: 'yaml', label: 'YAML', prism: 'yaml' },
];
export const langLabel = (id?: string) => LANGUAGES.find((l) => l.id === id)?.label || 'Plain Text';

export function highlightCode(src: string, lang: string): string {
  const l = LANGUAGES.find((x) => x.id === lang);
  const grammar = l?.prism ? Prism.languages[l.prism] : undefined;
  // a trailing newline needs a sentinel so the caret can sit on the empty last line
  const tail = src.endsWith('\n') ? '\u200b' : '';
  if (!grammar) return escapeHtml(src) + tail;
  return Prism.highlight(src, grammar, l!.prism!) + tail;
}
