# Example: Expo app

An Expo Router app using `expo-notifications-client` from the parent folder. It registers the device with the
[Laravel example](https://github.com/M0D1xD/expo-notification/tree/main/example), shows tracked pushes (also when the
app is in the background or killed), and reports `received` and `opened`. The screen shows the device identity, the
event queue and the data of the last opened notification, with Logout and Unregister buttons.

The client is set up in [`src/push.ts`](src/push.ts) (imported first by [`index.ts`](index.ts)) and
[`src/hooks/use-notification-tracking.ts`](src/hooks/use-notification-tracking.ts).

## Run it

You need an Android phone, an EAS project with your FCM key uploaded (expo.dev → project → Credentials), and the
`google-services.json` of a Firebase Android app.

```bash
cd example
bun install                  # or npm install
cp .env.example .env.local   # then fill it in, see below
cp ~/Downloads/google-services.json .
bunx expo run:android --variant release --device
```

| `.env.local` | |
|---|---|
| `EXPO_PUBLIC_API_URL` | The Laravel example, reachable from the phone, e.g. `http://192.168.1.20:8000` (run it with `--host 0.0.0.0`) |
| `EAS_PROJECT_ID`, `EXPO_OWNER` | Your EAS project (`eas init` prints them) |
| `ANDROID_PACKAGE` | The package name of your Firebase Android app |
| `EXPO_PUBLIC_PUSH_DEBUG` | `1` logs the client's requests and events in release builds too |

Cleartext HTTP is allowed (`expo-build-properties`) so the phone can reach the dev server on your LAN.

Then send from the dashboard (**Notifications → Send notification**) and watch the notification page: delivered when
the phone reports it, opened when you tap it.

## How the client is linked

`expo-notifications-client` is not installed from npm here. [`metro.config.js`](metro.config.js) resolves it to the
parent folder (its `react-native` entry, `src/index.ts`) and hides the parent's `node_modules`, so there is one copy of
react-native. `tsconfig.json` maps it the same way. Changes to `../src` show up on the next reload.

In your own app, install it from npm instead: see the [client README](../README.md).
