import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandBar } from './CommandBar.jsx';

function makeCommands() {
  return [
    { id: 'a', label: 'Format', group: 'Edit', onRun: vi.fn() },
    { id: 'b', label: 'Minify', group: 'Edit', onRun: vi.fn() },
    { id: 'c', label: 'Toggle wrap', group: 'View', onRun: vi.fn() },
  ];
}

describe('CommandBar', () => {
  it('renders nothing when closed', () => {
    render(<CommandBar open={false} onClose={vi.fn()} commands={makeCommands()} />);
    expect(screen.queryByPlaceholderText('Type a command…')).not.toBeInTheDocument();
  });

  it('lists every command, grouped by their group label', () => {
    render(<CommandBar open onClose={vi.fn()} commands={makeCommands()} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Format/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Minify/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle wrap/ })).toBeInTheDocument();
  });

  it('filters commands by label as you type', () => {
    render(<CommandBar open onClose={vi.fn()} commands={makeCommands()} />);
    fireEvent.change(screen.getByPlaceholderText('Type a command…'), { target: { value: 'min' } });
    expect(screen.getByRole('button', { name: /Minify/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Format/ })).not.toBeInTheDocument();
  });

  it('also matches against the group name', () => {
    render(<CommandBar open onClose={vi.fn()} commands={makeCommands()} />);
    fireEvent.change(screen.getByPlaceholderText('Type a command…'), { target: { value: 'view' } });
    expect(screen.getByRole('button', { name: /Toggle wrap/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Format/ })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<CommandBar open onClose={vi.fn()} commands={makeCommands()} />);
    fireEvent.change(screen.getByPlaceholderText('Type a command…'), { target: { value: 'zzz-nope' } });
    expect(screen.getByText('No matching commands.')).toBeInTheDocument();
  });

  it('clicking a command runs it and closes the bar', () => {
    const commands = makeCommands();
    const onClose = vi.fn();
    render(<CommandBar open onClose={onClose} commands={commands} />);
    fireEvent.click(screen.getByRole('button', { name: /Minify/ }));
    expect(commands[1].onRun).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown/ArrowUp move the active selection, wrapping at the ends', () => {
    const commands = makeCommands();
    render(<CommandBar open onClose={vi.fn()} commands={commands} />);
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // wraps to the last item
    expect(screen.getByRole('button', { name: /Toggle wrap/ })).toHaveClass('active');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // wraps back to the first
    expect(screen.getByRole('button', { name: /Format/ })).toHaveClass('active');
  });

  it('Enter runs the currently-active command', () => {
    const commands = makeCommands();
    const onClose = vi.fn();
    render(<CommandBar open onClose={onClose} commands={commands} />);
    const input = screen.getByPlaceholderText('Type a command…');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // Format -> Minify
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(commands[1].onRun).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes without running anything', () => {
    const commands = makeCommands();
    const onClose = vi.fn();
    render(<CommandBar open onClose={onClose} commands={commands} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Type a command…'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(commands.every((c) => !c.onRun.mock.calls.length)).toBe(true);
  });

  it('resets the query and active index each time it reopens', () => {
    const commands = makeCommands();
    const { rerender } = render(<CommandBar open onClose={vi.fn()} commands={commands} />);
    fireEvent.change(screen.getByPlaceholderText('Type a command…'), { target: { value: 'min' } });
    rerender(<CommandBar open={false} onClose={vi.fn()} commands={commands} />);
    rerender(<CommandBar open onClose={vi.fn()} commands={commands} />);
    expect(screen.getByPlaceholderText('Type a command…').value).toBe('');
  });

  it('shows a shortcut badge when a command declares one', () => {
    const commands = [{ id: 'a', label: 'Save', group: 'Edit', shortcut: '⌘S', onRun: vi.fn() }];
    render(<CommandBar open onClose={vi.fn()} commands={commands} />);
    expect(screen.getByText('⌘S')).toBeInTheDocument();
  });
});
