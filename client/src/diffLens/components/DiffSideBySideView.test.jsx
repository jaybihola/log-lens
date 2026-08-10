import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { DiffSideBySideView } from './DiffSideBySideView.jsx';

const OPTIONS = { ignoreWhitespace: false, ignoreCase: false, ignoreBlankLines: false, ignoreLineEndings: false };

// The one component talking to raw @codemirror/state/view + @codemirror/
// merge's MergeView directly instead of through <CodeMirror> — worth its
// own mount smoke test since that's a materially different integration
// path than every other editor in the app.
describe('DiffSideBySideView', () => {
  it('mounts two real editor panes and renders both sides\' text', () => {
    const { container } = render(
      <DiffSideBySideView
        leftText="line1\nline2" rightText="line1\nCHANGED"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(2);
    expect(container.textContent).toContain('line1');
    expect(container.textContent).toContain('CHANGED');
  });

  it('reports the initial chunk list via onChunksChange on mount', () => {
    const onChunksChange = vi.fn();
    render(
      <DiffSideBySideView
        leftText="a" rightText="b"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={onChunksChange}
      />,
    );
    expect(onChunksChange).toHaveBeenCalled();
    const chunks = onChunksChange.mock.calls[0][0];
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('reports no chunks for identical text', () => {
    const onChunksChange = vi.fn();
    render(
      <DiffSideBySideView
        leftText="same" rightText="same"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={onChunksChange}
      />,
    );
    expect(onChunksChange).toHaveBeenLastCalledWith([]);
  });

  it('exposes goToNext/goToPrevious on the ref without throwing', () => {
    const ref = createRef();
    render(
      <DiffSideBySideView
        ref={ref}
        leftText="a\nb\nc" rightText="a\nX\nc"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={vi.fn()}
      />,
    );
    expect(() => ref.current.goToNext()).not.toThrow();
    expect(() => ref.current.goToPrevious()).not.toThrow();
  });

  it('updates the live doc when leftText/rightText props change externally (e.g. Swap)', () => {
    const { container, rerender } = render(
      <DiffSideBySideView
        leftText="left-original" rightText="right-original"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('left-original');
    rerender(
      <DiffSideBySideView
        leftText="right-original" rightText="left-original"
        onLeftChange={vi.fn()} onRightChange={vi.fn()}
        language="plaintext" options={OPTIONS} onChunksChange={vi.fn()}
      />,
    );
    const editors = container.querySelectorAll('.cm-content');
    expect(editors[0].textContent).toBe('right-original');
    expect(editors[1].textContent).toBe('left-original');
  });
});
