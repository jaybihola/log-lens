import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';

// `icon` (opt-in, default false — every existing caller keeps its text
// label unchanged) prepends a Copy/Check glyph before the text label, for
// icon+label pill rows (e.g. a log line's hover actions). `iconOnly` (opt-in,
// implies `icon`) drops the text entirely — for dense icon-only button rows
// (e.g. the expanded-document field table) where a text label would be the
// odd one out next to icon-only siblings; relies on `title`/`description`'s
// Tooltip alone to explain itself, same as every other icon-only button in
// the app.
export function CopyButton({ text, label = 'Copy', className = '', title, description, icon = false, iconOnly = false }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API unavailable or permission denied — nothing more to do.
    }
  };

  const button = (
    <button type="button" className={className} onClick={copy}>
      {(icon || iconOnly) && (copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />)}
      {!iconOnly && (copied ? 'Copied!' : label)}
    </button>
  );

  return title ? <Tooltip label={title} description={description}>{button}</Tooltip> : button;
}
