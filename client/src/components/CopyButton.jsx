import { useState } from 'react';

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

  return (
    <button type="button" className={className} title={title} onClick={copy}>
      {copied ? 'Copied!' : label}
    </button>
  );
}
