import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import { api } from './api';
import { debug, getConfig } from './config';
import { createEventQueue, type EventSource, type EventType } from './event-queue';
import { readIdentity } from './identity';
import { findNotificationId, findPushData } from './payload';
import { getExpoPushToken, registerToken } from './register';

export const eventQueue = createEventQueue({
  storage: AsyncStorage,
  async post(events) {
    const identity = await readIdentity();
    // Without a registered pair the server would reject the batch; keep it queued instead.
    if (!identity) throw new Error('expo-notification-client: device not registered yet.');
    await api.sendEvents(identity, events);
  },
});

/**
 * Queue an event for the notification found in `payload` and try to send the queue. Pushes without a
 * `notificationId` (not sent through the server's PushNotifier) are ignored. Send failures are swallowed:
 * events stay queued and go out on the next flush.
 */
export async function track(type: EventType, source: EventSource, payload: unknown): Promise<boolean> {
  const notificationId = findNotificationId(payload);
  if (!notificationId) return false;
  const added = await eventQueue.add({
    notificationId,
    type,
    source,
    appState: AppState.currentState ?? 'unknown',
    at: new Date().toISOString(),
  });
  debug('track', type, source, notificationId, added ? '' : '(already recorded)');
  if (added) await flushQuietly();
  return added;
}

export async function flushQuietly(): Promise<number> {
  try {
    return await eventQueue.flush();
  } catch (error) {
    debug('flush failed, events stay queued', error);
    return 0;
  }
}

export type TrackingOptions = {
  /** Called once per tap, with the push's `data` (e.g. a deep link `url`). */
  onOpen?: (data: Record<string, unknown>, response: Notifications.NotificationResponse) => void;
};

const handledResponses = new Set<string>();

/**
 * Record foreground receipts and taps, including the tap that launched the app from killed (cold start), send the
 * queue whenever the app becomes active, and re-register when the OS rotates the push token. Returns a cleanup.
 */
export function startTracking({ onOpen }: TrackingOptions = {}): () => void {
  if (getConfig().showInForeground) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  const open = (response: Notifications.NotificationResponse, source: EventSource) => {
    // The listener and the cold-start lookup can both report the launching tap.
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
    void track('opened', source, response);
    const { render: _render, ...data } = findPushData(response) ?? response.notification.request.content.data ?? {};
    onOpen?.(data, response);
  };

  const subscriptions = [
    Notifications.addNotificationReceivedListener((notification) => void track('received', 'listener', notification)),
    Notifications.addNotificationResponseReceivedListener((response) => open(response, 'listener')),
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushQuietly();
    }),
    Notifications.addPushTokenListener((token) => void refreshToken(token)),
  ];

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    open(response, 'cold-start');
    return Notifications.clearLastNotificationResponseAsync();
  });
  void flushQuietly();

  return () => subscriptions.forEach((subscription) => subscription.remove());
}

async function refreshToken(devicePushToken: Notifications.DevicePushToken) {
  try {
    const identity = await readIdentity();
    if (!identity) return;
    const pushToken = await getExpoPushToken(devicePushToken);
    if (pushToken !== identity.pushToken) await registerToken(pushToken);
  } catch (error) {
    debug('token refresh failed', error);
  }
}
