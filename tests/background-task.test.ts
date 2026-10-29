import { beforeEach, describe, expect, test } from 'bun:test';

import { defineBackgroundTask, handleBackgroundNotification } from '../src/background-task';
import { configure } from '../src/config';
import { saveIdentity } from '../src/identity';
import { fakes, resetFakes } from './setup';

const headless = (data: Record<string, unknown>) =>
  ({ notification: null, data: { dataString: JSON.stringify(data) } }) as never;

beforeEach(async () => {
  resetFakes();
  configure({ apiUrl: 'https://api.test', channel: { id: 'alerts', name: 'Alerts' } });
  await saveIdentity({ deviceId: 'android-id', pushToken: 'ExponentPushToken[first]' });
});

describe('background task', () => {
  test('shows a data-only push from render and records it as received', async () => {
    const result = await handleBackgroundNotification(
      headless({ notificationId: 'n1', url: '/chats/1', render: { title: 'Hi', body: 'There', categoryId: 'reply' } }),
      null,
    );

    expect(result).toBe(1 as never);
    expect(fakes.scheduled).toEqual([
      {
        content: { title: 'Hi', body: 'There', data: { notificationId: 'n1', url: '/chats/1' }, categoryIdentifier: 'reply' },
        trigger: { channelId: 'alerts' },
      },
    ]);
    expect(fakes.requests[0].body.events).toMatchObject([{ notification_id: 'n1', type: 'received', source: 'task' }]);
  });

  test('records a background tap as opened without showing anything', async () => {
    await handleBackgroundNotification(
      { actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { request: { content: { data: { notificationId: 'n2' } } } } } as never,
      null,
    );

    expect(fakes.scheduled).toEqual([]);
    expect(fakes.requests[0].body.events).toMatchObject([{ notification_id: 'n2', type: 'opened' }]);
  });

  test('records but does not show a push without render content', async () => {
    await handleBackgroundNotification(headless({ notificationId: 'n3' }), null);

    expect(fakes.scheduled).toEqual([]);
    expect(fakes.requests).toHaveLength(1);
  });

  test('is defined once', () => {
    defineBackgroundTask();
    const task = fakes.task;
    defineBackgroundTask();

    expect(task).not.toBeNull();
    expect(fakes.task).toBe(task);
  });
});
