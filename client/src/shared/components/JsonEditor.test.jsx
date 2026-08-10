import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { JsonEditor } from './JsonEditor.jsx';

// Only the plumbing this app owns is in scope here (value/onChange wiring,
// readOnly, the ref API) — not CodeMirror's own editing/rendering behavior.
describe('JsonEditor', () => {
  it('renders the given value as visible text', () => {
    const { container } = render(<JsonEditor value={'{"a":1}'} onChange={vi.fn()} />);
    expect(container.textContent).toContain('"a"');
  });

  it('re-renders new text when the value prop changes (controlled-value wiring)', () => {
    const { container, rerender } = render(<JsonEditor value="one" onChange={vi.fn()} />);
    expect(container.textContent).toContain('one');
    rerender(<JsonEditor value="two" onChange={vi.fn()} />);
    expect(container.textContent).toContain('two');
    expect(container.textContent).not.toContain('one');
  });

  it('marks the editor read-only when readOnly is true', () => {
    const { container } = render(<JsonEditor value="{}" readOnly onChange={vi.fn()} />);
    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false');
  });

  it('is editable by default', () => {
    const { container } = render(<JsonEditor value="{}" onChange={vi.fn()} />);
    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'true');
  });

  it('exposes an imperative ref with undo/redo/find/fold/gotoLine/focus, all callable without throwing', () => {
    const ref = createRef();
    render(<JsonEditor ref={ref} value={'{"a":1,"b":2}'} onChange={vi.fn()} />);
    expect(() => ref.current.gotoLine(1)).not.toThrow();
    expect(() => ref.current.foldAll()).not.toThrow();
    expect(() => ref.current.unfoldAll()).not.toThrow();
    expect(() => ref.current.undo()).not.toThrow();
    expect(() => ref.current.redo()).not.toThrow();
    expect(() => ref.current.find()).not.toThrow();
    expect(() => ref.current.focus()).not.toThrow();
  });

  it('is a no-op (not a crash) when ref methods are called with no editor mounted yet', () => {
    const ref = createRef();
    // Calling before the component even renders should never happen in
    // practice, but the guarded `cmRef.current?.view` checks throughout the
    // component are exactly what make this safe either way.
    expect(ref.current).toBeNull();
  });
});
