import { useState } from 'react';
import { Tooltip } from './Tooltip.jsx';

export function CopyButton({ text, label = 'Copy', className = '', title }) {
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
      {copied ? 'Copied!' : label}
    </button>
  );

  return title ? <Tooltip label={title}>{button}</Tooltip> : button;
}
