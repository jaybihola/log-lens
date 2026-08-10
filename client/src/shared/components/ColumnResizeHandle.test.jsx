import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColumnResizeHandle } from './ColumnResizeHandle.jsx';

afterEach(() => document.body.classList.remove('col-resizing'));

describe('ColumnResizeHandle', () => {
  it('reports a live width as you drag, based on the delta from the drag start', () => {
    const onChange = vi.fn();
    const { container } = render(<ColumnResizeHandle width={100} onChange={onChange} />);
    const handle = container.querySelector('.col-resize-handle');

    fireEvent.mouseDown(handle, { clientX: 50 });
    fireEvent.mouseMove(document, { clientX: 70 });
    expect(onChange).toHaveBeenLastCalledWith(120);
    fireEvent.mouseMove(document, { clientX: 30 });
    expect(onChange).toHaveBeenLastCalledWith(80);
  });

  it('adds a col-resizing class to <body> while dragging, removed on mouseup', () => {
    const { container } = render(<ColumnResizeHandle width={100} onChange={vi.fn()} />);
    const handle = container.querySelector('.col-resize-handle');
    fireEvent.mouseDown(handle, { clientX: 50 });
    expect(document.body.classList.contains('col-resizing')).toBe(true);
    fireEvent.mouseUp(document);
    expect(document.body.classList.contains('col-resizing')).toBe(false);
  });

  it('stops reporting further moves after mouseup', () => {
    const onChange = vi.fn();
    const { container } = render(<ColumnResizeHandle width={100} onChange={onChange} />);
    const handle = container.querySelector('.col-resize-handle');
    fireEvent.mouseDown(handle, { clientX: 50 });
    fireEvent.mouseUp(document);
    onChange.mockClear();
    fireEvent.mouseMove(document, { clientX: 200 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a plain click on the handle does not bubble up to a resizable header\'s own click handler', () => {
    const onHeaderClick = vi.fn();
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onHeaderClick}><ColumnResizeHandle width={100} onChange={vi.fn()} /></div>,
    );
    fireEvent.click(container.querySelector('.col-resize-handle'));
    expect(onHeaderClick).not.toHaveBeenCalled();
  });
});
