import {
  eventQueue,
  flushQuietly,
  logout,
  readIdentity,
  register,
  startTracking,
  unregister,
  type Identity,
  type TrackedEvent,
} from 'expo-notifications-client';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Register on launch, start tracking, and expose the identity and the event queue for the screen. */
export function useNotificationTracking() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [error, setError] = useState<string | null>(null),
    [lastOpened, setLastOpened] = useState<Record<string, unknown> | null>(null),
    [pending, setPending] = useState<TrackedEvent[]>([]),
    [history, setHistory] = useState<TrackedEvent[]>([]);

  const refresh = useCallback(async () => {
    const [p, h, i] = await Promise.all([eventQueue.pending(), eventQueue.history(), readIdentity()]);
    setPending(p);
    setHistory(h);
    setIdentity(i);
  }, []);

  const run = useCallback(
    (action: () => Promise<unknown>) => async () => {
      try {
        await action();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void run(register)();
    const stop = startTracking({ onOpen: (data) => setLastOpened(data) });
    // Events go out in the background; refresh the lists when the app comes back.
    const appState = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      stop();
      appState.remove();
    };
  }, [run, refresh]);

  return {
    identity,
    error,
    lastOpened,
    pending,
    history,
    refresh,
    register: run(register),
    logout: run(logout),
    unregister: run(unregister),
    flush: run(flushQuietly),
  };
}
