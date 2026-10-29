# expo-notification-client

React Native client for the Laravel package [m0d1xd/expo-notification](https://github.com/M0D1xD/expo-notification).
It registers the device, shows the server's tracked pushes, and reports what happened to each notification:
received and opened.

> **Status: early development**, not published to npm yet. Android is verified on real devices; iOS is not tested yet.

## Requirements

- Expo SDK 57+ with `expo-notifications`, `expo-task-manager`, `expo-application`, `expo-device`, `expo-constants`
  and `@react-native-async-storage/async-storage` installed in the app.
- A development or release build (push notifications do not work in Expo Go).
- The Laravel app with `m0d1xd/expo-notification` installed and `tracking.enabled` on (the default).

## Setup

In the app's entry file, before anything else renders. Android starts the bundle headless for a data-only push and
runs only module-scope code, so both calls must be at module scope:

```ts
// src/push.ts, imported first by index.ts
import { configure, defineBackgroundTask } from 'expo-notification-client';

configure({
  apiUrl: 'https://api.example.com',
  // Assigns the device to the signed-in user (Sanctum token, etc.). Use routes.guard on the server to match.
  headers: async () => {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
defineBackgroundTask();
```

```ts
// index.ts
import './src/push';
import 'expo-router/entry';
```

Then in the app:

```ts
import { logout, register, startTracking } from 'expo-notification-client';

useEffect(() => {
  register(); // asks for permission once, then registers the device; call again after sign-in
  return startTracking({ onOpen: (data) => data.url && router.push(String(data.url)) });
}, []);

// On sign-out (works with an expired session too):
await logout();
```

## API

| Function | What it does |
|---|---|
| `configure(config)` | `apiUrl`, `prefix` (default `expo-notification`), `channel` (`{ id, name }`), `headers()`, `projectId`, `showInForeground` (default `true`), `debug` |
| `defineBackgroundTask()` | Shows data-only pushes from `data.render` and records `received`; records background taps as `opened` |
| `register()` | Permission → Android channel → Expo push token → `PUT push-tokens`. Sends `previous_push_token` when the token changed, so the server keeps the owner. Resolves to `null` on simulators or without permission |
| `startTracking({ onOpen })` | Records foreground receipts and taps, the tap that launched the app (cold start), sends queued events when the app becomes active, and re-registers when the OS rotates the token. Returns a cleanup function |
| `logout()` | `POST push-tokens/detach`: the device stays registered as a guest |
| `unregister()` | `DELETE push-tokens`: no more pushes until `register()` runs again |
| `eventQueue` | `pending()` and `history()` for debugging |

Events are queued in AsyncStorage and sent in batches. Network errors, `5xx` and `429` are retried later; a `404`
(the device pair changed) waits for the next registration; a `422` batch is dropped. Each notification and event
type is reported once.

## What can be tracked (Android, verified)

| App state | received | opened |
|---|---|---|
| Foreground | yes (background task) | yes (listener) |
| Background | yes (background task) | yes |
| Killed by the system | yes (background task) | yes (on launch, `cold-start`) |
| Force-stopped by the user | no: Android does not start the app | — |

Dismissals cannot be detected on Android.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

The example app is [expo-notifications-example](../expo-notifications-example). It links this folder; its
`metro.config.js` hides this package's own `node_modules` so the app's single copy of react-native is used.

## License

MIT
