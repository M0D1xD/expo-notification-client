import { getConfig } from './config';
import type { TrackedEvent } from './event-queue';
import type { Identity } from './identity';

/** A non-2xx answer; `status` drives the event queue's retry rules. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`expo-notifications-client: HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

export type Registration = {
  device_id: string;
  push_token: string;
  platform: string;
  locale?: string | null;
  /** The token this device had before, so the server keeps the owner on rotation. */
  previous_push_token?: string | null;
};

export type EventsResult = { stored: number; duplicates: number; ignored: number };

const pair = (identity: Identity) => ({ device_id: identity.deviceId, push_token: identity.pushToken });

export const api = {
  register: (registration: Registration) => request('PUT', 'push-tokens', registration),
  detach: (identity: Identity) => request('POST', 'push-tokens/detach', pair(identity)),
  unregister: (identity: Identity) => request('DELETE', 'push-tokens', pair(identity)),
  sendEvents: (identity: Identity, events: TrackedEvent[]) =>
    request('POST', 'push-events', {
      ...pair(identity),
      events: events.map((e) => ({
        notification_id: e.notificationId,
        type: e.type,
        source: e.source,
        app_state: e.appState,
        occurred_at: e.at,
      })),
    }) as Promise<EventsResult>,
};

async function request(method: string, path: string, body: object): Promise<unknown> {
  const { apiUrl, prefix, headers } = getConfig();
  const response = await fetch(`${apiUrl}/${prefix}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(await headers?.()) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.status === 204 ? null : response.json();
}
