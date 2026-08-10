import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';

// One entry per language dropdown option. `extension` is a factory (not a
// live extension instance) so each editor that asks for it gets its own —
// several of these (esp. lang-javascript) hold local parser state that two
// editors must not share.
export const LANGUAGES = [
  { value: 'plaintext', label: 'Plain text', extension: () => [] },
  { value: 'json', label: 'JSON', extension: () => json() },
  { value: 'xml', label: 'XML', extension: () => xml() },
  { value: 'html', label: 'HTML', extension: () => html() },
  { value: 'css', label: 'CSS', extension: () => css() },
  { value: 'javascript', label: 'JavaScript', extension: () => javascript() },
  { value: 'jsx', label: 'JSX', extension: () => javascript({ jsx: true }) },
  { value: 'typescript', label: 'TypeScript', extension: () => javascript({ typescript: true }) },
  { value: 'tsx', label: 'TSX', extension: () => javascript({ jsx: true, typescript: true }) },
  { value: 'python', label: 'Python', extension: () => python() },
  { value: 'java', label: 'Java', extension: () => java() },
  { value: 'cpp', label: 'C / C++', extension: () => cpp() },
  { value: 'go', label: 'Go', extension: () => go() },
  { value: 'rust', label: 'Rust', extension: () => rust() },
  { value: 'php', label: 'PHP', extension: () => php() },
  { value: 'sql', label: 'SQL', extension: () => sql() },
  { value: 'yaml', label: 'YAML', extension: () => yaml() },
  { value: 'markdown', label: 'Markdown', extension: () => markdown() },
  { value: 'shell', label: 'Shell / Bash', extension: () => StreamLanguage.define(shell) },
];

const LANGUAGE_BY_VALUE = new Map(LANGUAGES.map((l) => [l.value, l]));

export function languageExtension(value) {
  return (LANGUAGE_BY_VALUE.get(value) || LANGUAGE_BY_VALUE.get('plaintext')).extension();
}

// Deliberately narrow: full content-sniffing language detection is
// unreliable, so this only recognizes the two cases that are both cheap and
// very unlikely to be wrong. Anything else stays 'plaintext' until the user
// picks a language themselves.
export function detectLanguage(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'plaintext';
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && isValidJson(trimmed)) return 'json';
  if (trimmed.startsWith('<')) return /<html[\s>]|<!DOCTYPE html/i.test(trimmed) ? 'html' : 'xml';
  return 'plaintext';
}

function isValidJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
