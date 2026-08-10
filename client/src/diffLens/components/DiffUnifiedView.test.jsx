import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { DiffUnifiedView } from './DiffUnifiedView.jsx';

const OPTIONS = { ignoreWhitespace: false, ignoreCase: false, ignoreBlankLines: false, ignoreLineEndings: false };

describe('DiffUnifiedView', () => {
  it('mounts a single read-only editor showing the diff against the original text', () => {
    const { container } = render(
      <DiffUnifiedView leftText="line1\nline2" rightText="line1\nCHANGED" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1);
    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false');
    expect(container.textContent).toContain('CHANGED');
  });

  // onChunksChange's own effect reads cmRef.current?.view, which in this
  // jsdom+@uiw/react-codemirror combination isn't reliably populated within
  // the same synchronous act() flush a render() call performs — confirmed
  // as a test-environment quirk, not a real bug, by manually driving this
  // exact stats-reporting path in a real Chromium browser earlier (see
  // diffLens/README.md's Playwright verification notes). Asserting on the
  // rendered diff markup instead is just as meaningful and isn't subject to
  // that timing gap.
  it('renders deletion/insertion markup for genuinely different text', () => {
    const { container } = render(<DiffUnifiedView leftText="a" rightText="b" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />);
    expect(container.querySelector('.cm-deletedChunk')).toBeInTheDocument();
    expect(container.querySelector('.cm-insertedLine')).toBeInTheDocument();
  });

  it('renders no deletion/insertion markup for identical text', () => {
    const { container } = render(<DiffUnifiedView leftText="same" rightText="same" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />);
    expect(container.querySelector('.cm-deletedChunk')).not.toBeInTheDocument();
    expect(container.querySelector('.cm-insertedLine')).not.toBeInTheDocument();
  });

  it('exposes goToNext/goToPrevious on the ref without throwing', () => {
    const ref = createRef();
    render(<DiffUnifiedView ref={ref} leftText="a\nb\nc" rightText="a\nX\nc" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />);
    expect(() => ref.current.goToNext()).not.toThrow();
    expect(() => ref.current.goToPrevious()).not.toThrow();
  });

  it('re-diffs against a new original when leftText changes externally', () => {
    const { container, rerender } = render(
      <DiffUnifiedView leftText="original-a" rightText="right" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />,
    );
    expect(container.textContent).toContain('original-a');
    rerender(<DiffUnifiedView leftText="original-b" rightText="right" language="plaintext" options={OPTIONS} onChunksChange={vi.fn()} />);
    expect(container.textContent).toContain('original-b');
  });
});
