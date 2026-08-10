import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveEvents } from './useLiveEvents.js';

// jsdom has no EventSource — a minimal fake standing in for the real SSE
// connection the hook opens, letting tests dispatch synthetic events at it
// exactly like the server would (see server/src/logLens/sse.js for the real
// event shapes this mirrors: unnamed `message` for lines, named `boot`/`status`).
class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.onmessage = null;
    this.closed = false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, cb) {
    (this.listeners[type] ||= []).push(cb);
  }

  dispatch(type, data) {
    const event = { data: JSON.stringify(data) };
    if (type === 'message') this.onmessage?.(event);
    else (this.listeners[type] || []).forEach((cb) => cb(event));
  }

  close() { this.closed = true; }
}
FakeEventSource.instances = [];

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => vi.unstubAllGlobals());

describe('useLiveEvents', () => {
  it('opens a connection to /api/events on mount', () => {
    renderHook(() => useLiveEvents({}));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/api/events');
  });

  it('closes the connection on unmount', () => {
    const { unmount } = renderHook(() => useLiveEvents({}));
    const es = FakeEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it('dispatches an unnamed message event to onLine, parsed', () => {
    const onLine = vi.fn();
    renderHook(() => useLiveEvents({ onLine }));
    const es = FakeEventSource.instances[0];
    act(() => es.dispatch('message', { tabId: '1', seq: 5, text: 'hello' }));
    expect(onLine).toHaveBeenCalledWith({ tabId: '1', seq: 5, text: 'hello' });
  });

  it('dispatches a status event to onStatus, parsed', () => {
    const onStatus = vi.fn();
    renderHook(() => useLiveEvents({ onStatus }));
    const es = FakeEventSource.instances[0];
    act(() => es.dispatch('status', { tabId: '1', status: 'watching' }));
    expect(onStatus).toHaveBeenCalledWith({ tabId: '1', status: 'watching' });
  });

  it('remembers the first boot id without firing onBootChanged', () => {
    const onBootChanged = vi.fn();
    renderHook(() => useLiveEvents({ onBootChanged }));
    const es = FakeEventSource.instances[0];
    act(() => es.dispatch('boot', { bootId: 'a' }));
    expect(onBootChanged).not.toHaveBeenCalled();
  });

  it('fires onBootChanged when a later boot event has a different id', () => {
    const onBootChanged = vi.fn();
    renderHook(() => useLiveEvents({ onBootChanged }));
    const es = FakeEventSource.instances[0];
    act(() => es.dispatch('boot', { bootId: 'a' }));
    act(() => es.dispatch('boot', { bootId: 'b' }));
    expect(onBootChanged).toHaveBeenCalledTimes(1);
  });

  it('does not fire onBootChanged when the same boot id repeats', () => {
    const onBootChanged = vi.fn();
    renderHook(() => useLiveEvents({ onBootChanged }));
    const es = FakeEventSource.instances[0];
    act(() => es.dispatch('boot', { bootId: 'a' }));
    act(() => es.dispatch('boot', { bootId: 'a' }));
    expect(onBootChanged).not.toHaveBeenCalled();
  });

  it('always calls the latest handler even though the connection is opened once', () => {
    const onLineA = vi.fn();
    const onLineB = vi.fn();
    const { rerender } = renderHook(({ onLine }) => useLiveEvents({ onLine }), { initialProps: { onLine: onLineA } });
    rerender({ onLine: onLineB });
    const es = FakeEventSource.instances[0];
    expect(FakeEventSource.instances).toHaveLength(1); // no reconnect on prop change
    act(() => es.dispatch('message', { tabId: '1', seq: 1, text: 'x' }));
    expect(onLineA).not.toHaveBeenCalled();
    expect(onLineB).toHaveBeenCalled();
  });
});
