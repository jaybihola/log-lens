import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';

// `icon` (opt-in, default false — every existing caller keeps its text
// label unchanged) swaps the text label for a Copy/Check glyph, for the
// dense icon-button rows (e.g. a log line's hover actions) where a text
// button would be the odd one out next to icon-only siblings.
export function CopyButton({ text, label = 'Copy', className = '', title, description, icon = false }) {
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
      {icon
        ? (copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />)
        : (copied ? 'Copied!' : label)}
    </button>
  );

  return title ? <Tooltip label={title} description={description}>{button}</Tooltip> : button;
}
