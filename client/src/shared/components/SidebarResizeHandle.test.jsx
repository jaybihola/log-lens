import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SidebarResizeHandle } from './SidebarResizeHandle.jsx';

afterEach(() => document.body.classList.remove('col-resizing'));

describe('SidebarResizeHandle', () => {
  it('reports a live width as you drag, same drag math as ColumnResizeHandle', () => {
    const onChange = vi.fn();
    const { container } = render(<SidebarResizeHandle width={260} onChange={onChange} />);
    const handle = container.querySelector('.fields-sidebar-resize-handle');

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 150 });
    expect(onChange).toHaveBeenLastCalledWith(310);
  });

  it('toggles the col-resizing class on <body> across the drag lifecycle', () => {
    const { container } = render(<SidebarResizeHandle width={260} onChange={vi.fn()} />);
    const handle = container.querySelector('.fields-sidebar-resize-handle');
    fireEvent.mouseDown(handle, { clientX: 100 });
    expect(document.body.classList.contains('col-resizing')).toBe(true);
    fireEvent.mouseUp(document);
    expect(document.body.classList.contains('col-resizing')).toBe(false);
  });

  it('stops reporting moves once the drag ends', () => {
    const onChange = vi.fn();
    const { container } = render(<SidebarResizeHandle width={260} onChange={onChange} />);
    fireEvent.mouseDown(container.querySelector('.fields-sidebar-resize-handle'), { clientX: 100 });
    fireEvent.mouseUp(document);
    onChange.mockClear();
    fireEvent.mouseMove(document, { clientX: 400 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
