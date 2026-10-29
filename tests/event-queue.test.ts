import { describe, expect, test } from 'bun:test';

import { createEventQueue, type TrackedEvent } from '../src/event-queue';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
  };
}

function event(notificationId: string, type: TrackedEvent['type'] = 'received'): TrackedEvent {
  return { notificationId, type, source: 'task', appState: 'background', at: '2026-10-29T00:00:00Z' };
}

const noSleep = async () => {};

describe('event queue', () => {
  test('queues events and flushes them in one batch', async () => {
    const sent: TrackedEvent[][] = [],
      queue = createEventQueue({ storage: memoryStorage(), post: async (e) => void sent.push(e) });
    await queue.add(event('n1'));
    await queue.add(event('n1', 'opened'));

    expect(await queue.flush()).toBe(2);
    expect(sent).toHaveLength(1);
    expect(sent[0].map((e) => e.type)).toEqual(['received', 'opened']);
    expect(await queue.pending()).toEqual([]);
    expect(await queue.history()).toHaveLength(2);
  });

  test('drops a repeat of the same notification and type, even after it was sent', async () => {
    const queue = createEventQueue({ storage: memoryStorage(), post: async () => {} });
    expect(await queue.add(event('n1'))).toBe(true);
    expect(await queue.add(event('n1'))).toBe(false);
    await queue.flush();
    expect(await queue.add(event('n1'))).toBe(false);
    expect(await queue.add(event('n1', 'opened'))).toBe(true);
  });

  test('retries server errors, then succeeds', async () => {
    let calls = 0;
    const queue = createEventQueue({
      storage: memoryStorage(),
      sleep: noSleep,
      post: async () => {
        if (++calls < 3) throw { status: 503 };
      },
    });
    await queue.add(event('n1'));
    expect(await queue.flush()).toBe(1);
    expect(calls).toBe(3);
  });

  test('keeps events queued when the network stays down', async () => {
    const queue = createEventQueue({
      storage: memoryStorage(),
      sleep: noSleep,
      post: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await queue.add(event('n1'));
    await expect(queue.flush()).rejects.toThrow('Network request failed');
    expect(await queue.pending()).toHaveLength(1);
  });

  test('drops a batch the server rejects as invalid (422) instead of blocking the queue', async () => {
    const queue = createEventQueue({
      storage: memoryStorage(),
      sleep: noSleep,
      post: async () => {
        throw { status: 422 };
      },
    });
    await queue.add(event('n1'));
    expect(await queue.flush()).toBe(1);
    expect(await queue.pending()).toEqual([]);
  });

  test('does not retry client errors', async () => {
    let calls = 0;
    const queue = createEventQueue({
      storage: memoryStorage(),
      sleep: noSleep,
      post: async () => {
        calls++;
        throw { status: 404 };
      },
    });
    await queue.add(event('n1'));
    await expect(queue.flush()).rejects.toEqual({ status: 404 });
    expect(calls).toBe(1);
    expect(await queue.pending()).toHaveLength(1);
  });

  test('flushing an empty queue sends nothing', async () => {
    let calls = 0;
    const queue = createEventQueue({ storage: memoryStorage(), post: async () => void calls++ });
    expect(await queue.flush()).toBe(0);
    expect(calls).toBe(0);
  });
});
