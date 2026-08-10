import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from './ContextMenu.jsx';

const ITEMS = [
  { label: 'Rename', onClick: vi.fn() },
  { divider: true },
  { label: 'Delete', onClick: vi.fn(), danger: true },
  { label: 'Disabled action', onClick: vi.fn(), disabled: true },
];

describe('ContextMenu', () => {
  it('renders every non-divider item as a button, and dividers as their own element', () => {
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(document.querySelector('.context-menu-divider')).toBeInTheDocument();
  });

  it('marks a danger item with the danger class', () => {
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('danger');
  });

  it('disables an item flagged disabled', () => {
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Disabled action' })).toBeDisabled();
  });

  it('clicking an item runs its onClick and then closes the menu', () => {
    const onClose = vi.fn();
    const onClick = vi.fn();
    render(<ContextMenu x={10} y={10} items={[{ label: 'Go', onClick }]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on an outside click, but not a click inside the menu', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Rename' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on scroll anywhere in the document', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={10} items={ITEMS} onClose={onClose} />);
    fireEvent.scroll(document);
    expect(onClose).toHaveBeenCalled();
  });

  it('clamps its position so it stays within the viewport near an edge', () => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({ width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100 });
    try {
      // Click far past the right/bottom edge of a (jsdom-default) small viewport.
      render(<ContextMenu x={5000} y={5000} items={[{ label: 'X', onClick: vi.fn() }]} onClose={vi.fn()} />);
      const menu = document.querySelector('.context-menu');
      const left = parseFloat(menu.style.left);
      const top = parseFloat(menu.style.top);
      expect(left).toBeLessThanOrEqual(window.innerWidth - 200 - 4 + 0.01);
      expect(top).toBeLessThanOrEqual(window.innerHeight - 100 - 4 + 0.01);
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });
});
