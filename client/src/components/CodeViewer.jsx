import { useMemo } from 'react';
import { tryFormatJson } from '../render/highlight.js';
import { JsonEditor } from './JsonEditor.jsx';

// Read-only line-numbered, syntax-highlighted, fold-capable view of a single
// entry's full raw text — a single entry's "Show more" → JSON tab.
export function CodeViewer({ rawText }) {
  const pretty = useMemo(() => tryFormatJson(rawText), [rawText]);
  const isXml = pretty.trim()[0] === '<';
  return <JsonEditor value={pretty} readOnly language={isXml ? 'xml' : 'json'} />;
}
