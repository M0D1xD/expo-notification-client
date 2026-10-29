export type EventType = 'received' | 'opened' | 'dismissed';

/** Which code path saw the event: a foreground listener, the background task, or the cold-start response. */
export type EventSource = 'listener' | 'task' | 'cold-start';

export type TrackedEvent = {
  notificationId: string;
  type: EventType;
  source: EventSource;
  appState: string;
  at: string;
};

export type QueueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** Sends a batch; throws `{ status }` for HTTP errors or anything else for network failures. */
export type PostEvents = (events: TrackedEvent[]) => Promise<void>;

const QUEUE_KEY = 'expoNotificationClient.queue',
  HISTORY_KEY = 'expoNotificationClient.history',
  HISTORY_LIMIT = 100;

export function createEventQueue({
  storage,
  post,
  retryDelays = [2_000, 5_000, 15_000],
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  storage: QueueStorage;
  post: PostEvents;
  retryDelays?: number[];
  sleep?: (ms: number) => Promise<void>;
}) {
  /** Writes run one at a time, so a headless task and the UI never overwrite each other's queue. */
  let lock: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>) {
    const run = lock.then(fn);
    lock = run.catch(() => {});
    return run;
  }

  async function read(key: string): Promise<TrackedEvent[]> {
    try {
      return JSON.parse((await storage.getItem(key)) || '[]');
    } catch {
      return [];
    }
  }

  /** Queue an event; repeats of the same notification and type are dropped. Resolves to whether it was added. */
  function add(event: TrackedEvent) {
    return serial(async () => {
      const [queue, history] = await Promise.all([read(QUEUE_KEY), read(HISTORY_KEY)]),
        isDuplicate = (e: TrackedEvent) => key(e) === key(event);
      if (queue.some(isDuplicate) || history.some(isDuplicate)) return false;
      await storage.setItem(QUEUE_KEY, JSON.stringify([...queue, event]));
      return true;
    });
  }

  /**
   * Send everything queued. Network and 5xx errors are retried; other 4xx (404 stale device pair, 429 rate limit)
   * stop and keep the queue for the next flush. A 422 means the server will never accept the batch, so it is
   * dropped instead of blocking every later event.
   */
  function flush() {
    return serial(async () => {
      const queue = await read(QUEUE_KEY);
      if (!queue.length) return 0;
      for (let attempt = 0; ; attempt++) {
        try {
          await post(queue);
          break;
        } catch (error) {
          const status = (error as { status?: number } | null)?.status;
          if (status === 422) break;
          const isClientError = status !== undefined && status < 500;
          if (isClientError || attempt >= retryDelays.length) throw error;
          await sleep(retryDelays[attempt]);
        }
      }
      const history = [...queue, ...(await read(HISTORY_KEY))].slice(0, HISTORY_LIMIT);
      await storage.setItem(QUEUE_KEY, '[]');
      await storage.setItem(HISTORY_KEY, JSON.stringify(history));
      return queue.length;
    });
  }

  return {
    add,
    flush,
    pending: () => read(QUEUE_KEY),
    history: () => read(HISTORY_KEY),
  };
}

function key(e: TrackedEvent) {
  return `${e.notificationId}:${e.type}`;
}
