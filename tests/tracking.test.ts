import { beforeEach, describe, expect, test } from 'bun:test';

import { configure } from '../src/config';
import { saveIdentity } from '../src/identity';
import { eventQueue, startTracking, track } from '../src/tracking';
import { fakes, resetFakes } from './setup';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function response(notificationId: string, data: Record<string, unknown> = {}) {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { request: { identifier: `request-${notificationId}`, content: { data: { notificationId, ...data } } } },
  };
}

beforeEach(async () => {
  resetFakes();
  configure({ apiUrl: 'https://api.test' });
  await saveIdentity({ deviceId: 'android-id', pushToken: 'ExponentPushToken[first]' });
});

describe('track', () => {
  test('sends the event with the device pair in the server format', async () => {
    fakes.appState.currentState = 'background';

    expect(await track('received', 'task', { data: { notificationId: 'n1' } })).toBe(true);

    const [request] = fakes.requests;
    expect(request.url).toBe('https://api.test/expo-notification/push-events');
    expect(request.body).toMatchObject({
      device_id: 'android-id',
      push_token: 'ExponentPushToken[first]',
      events: [{ notification_id: 'n1', type: 'received', source: 'task', app_state: 'background' }],
    });
    expect(await eventQueue.pending()).toEqual([]);
  });

  test('ignores pushes without a notificationId', async () => {
    expect(await track('received', 'listener', { data: { url: '/x' } })).toBe(false);
    expect(fakes.requests).toEqual([]);
  });

  test('keeps events queued while the server is unreachable', async () => {
    fakes.respond = () => new Response('', { status: 404 });

    await track('received', 'task', { data: { notificationId: 'n2' } });

    expect((await eventQueue.pending()).map((e) => e.notificationId)).toEqual(['n2']);
  });
});

describe('startTracking', () => {
  test('records the cold-start tap once, calls onOpen with the data and clears it', async () => {
    const opened: unknown[] = [];
    fakes.lastResponse = response('cold', { url: '/chats/1', render: { title: 'Hi' } });

    const stop = startTracking({ onOpen: (data) => opened.push(data) });
    await settle();
    fakes.listeners.response(response('cold', { url: '/chats/1' }) as never);
    await settle();

    expect(opened).toEqual([{ notificationId: 'cold', url: '/chats/1' }]);
    expect(fakes.clearedLastResponse).toBe(1);
    const events = fakes.requests.flatMap((r) => (r.body.events as { type: string; source: string }[]) ?? []);
    expect(events.filter((e) => e.type === 'opened').map((e) => e.source)).toEqual(['cold-start']);
    stop();
    expect(fakes.listeners).toEqual({});
  });

  test('records foreground receipts and taps from the listeners', async () => {
    startTracking();
    fakes.listeners.received({ request: { content: { data: { notificationId: 'fg' } } } } as never);
    fakes.listeners.response(response('fg') as never);
    await settle();
    await settle();

    const types = fakes.requests.flatMap((r) => (r.body.events as { type: string }[]).map((e) => e.type));
    expect(types).toEqual(['received', 'opened']);
  });

  test('re-registers with the previous token when the OS rotates it', async () => {
    startTracking();
    fakes.expoPushToken = 'ExponentPushToken[rotated]';
    fakes.listeners.pushToken({ type: 'android', data: 'new-fcm' } as never);
    await settle();
    await settle();

    const registration = fakes.requests.find((r) => r.method === 'PUT');
    expect(registration?.body).toMatchObject({
      push_token: 'ExponentPushToken[rotated]',
      previous_push_token: 'ExponentPushToken[first]',
    });
  });
});
