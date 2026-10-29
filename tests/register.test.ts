import { beforeEach, describe, expect, test } from 'bun:test';

import { ApiError } from '../src/api';
import { configure } from '../src/config';
import { readIdentity } from '../src/identity';
import { logout, register, unregister } from '../src/register';
import { fakes, resetFakes } from './setup';

beforeEach(() => {
  resetFakes();
  configure({ apiUrl: 'https://api.test/', headers: async () => ({ Authorization: 'Bearer user-token' }) });
});

describe('register', () => {
  test('creates the channel and registers the device with the auth headers', async () => {
    const identity = await register();

    expect(identity).toEqual({ deviceId: 'android-id', pushToken: 'ExponentPushToken[first]' });
    expect(fakes.channels).toEqual(['default']);
    const [request] = fakes.requests;
    expect(request.method).toBe('PUT');
    expect(request.url).toBe('https://api.test/expo-notification/push-tokens');
    expect(request.headers.Authorization).toBe('Bearer user-token');
    expect(request.body).toMatchObject({
      device_id: 'android-id',
      push_token: 'ExponentPushToken[first]',
      platform: 'android',
      previous_push_token: null,
    });
    expect(await readIdentity()).toEqual(identity);
  });

  test('sends the previous token only when the token changed', async () => {
    await register();
    await register();
    fakes.expoPushToken = 'ExponentPushToken[second]';
    await register();

    expect(fakes.requests.map((r) => r.body.previous_push_token)).toEqual([null, null, 'ExponentPushToken[first]']);
  });

  test('keeps the old identity when the server rejects the new token', async () => {
    await register();
    fakes.expoPushToken = 'ExponentPushToken[second]';
    fakes.respond = () => new Response('down', { status: 503 });

    await expect(register()).rejects.toBeInstanceOf(ApiError);
    expect((await readIdentity())?.pushToken).toBe('ExponentPushToken[first]');
  });

  test('skips registration when permission is denied', async () => {
    fakes.permission = { granted: false, canAskAgain: false };

    expect(await register()).toBeNull();
    expect(fakes.requests).toEqual([]);
  });
});

describe('logout and unregister', () => {
  test('send the stored pair', async () => {
    await register();
    await logout();
    await unregister();

    const pair = { device_id: 'android-id', push_token: 'ExponentPushToken[first]' };
    expect(fakes.requests.slice(1).map((r) => [r.method, r.url.split('/').slice(-2).join('/'), r.body])).toEqual([
      ['POST', 'push-tokens/detach', pair],
      ['DELETE', 'expo-notification/push-tokens', pair],
    ]);
  });

  test('do nothing before the first registration', async () => {
    await logout();
    await unregister();

    expect(fakes.requests).toEqual([]);
  });
});
