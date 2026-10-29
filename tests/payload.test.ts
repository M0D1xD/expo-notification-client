import { describe, expect, test } from 'bun:test';

import { findNotificationId, findPushData, findRenderContent } from '../src/payload';

describe('findNotificationId', () => {
  test('reads it from a notification response', () => {
    const response = {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: { request: { content: { data: { notificationId: 'n1' } } } },
    };
    expect(findNotificationId(response)).toBe('n1');
  });

  test('reads it from a headless dataString', () => {
    const task = { notification: null, data: { dataString: JSON.stringify({ notificationId: 'n2' }) } };
    expect(findNotificationId(task)).toBe('n2');
  });

  test('reads it from an FCM body string', () => {
    const task = { notification: null, data: { body: JSON.stringify({ notificationId: 'n3' }) } };
    expect(findNotificationId(task)).toBe('n3');
  });

  test('returns null when absent or malformed', () => {
    expect(findNotificationId({ data: { body: '{notificationId' } })).toBeNull();
    expect(findNotificationId({ data: {} })).toBeNull();
    expect(findNotificationId(null)).toBeNull();
  });
});

describe('findPushData', () => {
  test('returns the whole data object, parsed out of a JSON string', () => {
    const data = { notificationId: 'n', url: '/chats/1', render: { title: 'Hi' } };
    expect(findPushData({ data: { dataString: JSON.stringify(data) } })).toEqual(data);
  });
});

describe('findRenderContent', () => {
  test('reads render content from a headless dataString', () => {
    const task = {
      data: {
        dataString: JSON.stringify({
          notificationId: 'n',
          render: { title: 'Hi', body: 'There', channelId: 'chats', categoryId: 'reply' },
        }),
      },
    };
    expect(findRenderContent(task)).toEqual({ title: 'Hi', body: 'There', channelId: 'chats', categoryId: 'reply' });
  });

  test('returns null without a title or without a notificationId', () => {
    expect(findRenderContent({ data: { notificationId: 'n', render: { body: 'x' } } })).toBeNull();
    expect(findRenderContent({ data: { render: { title: 'x' } } })).toBeNull();
    expect(findRenderContent({ data: {} })).toBeNull();
  });
});
