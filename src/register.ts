import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { debug, getConfig } from './config';
import { getDeviceId, readIdentity, saveIdentity, type Identity } from './identity';

/**
 * Ask for permission (once), create the Android channel, get the Expo push token and register the device.
 * Call it on launch, and again after sign-in so the server assigns the device to the user (via `headers`).
 * Resolves to null on simulators or when permission is denied.
 */
export async function register(): Promise<Identity | null> {
  if (!Device.isDevice) return (debug('skipped: not a physical device'), null);
  await ensureChannel();
  if (!(await ensurePermission())) return (debug('skipped: permission not granted'), null);
  return registerToken(await getExpoPushToken());
}

/** Logout: the device stays registered as a guest. Needs no auth, so it works with an expired session. */
export async function logout(): Promise<void> {
  const identity = await readIdentity();
  if (identity) await api.detach(identity);
}

/** Opt-out: the server stops sending to this device until it registers again. */
export async function unregister(): Promise<void> {
  const identity = await readIdentity();
  if (identity) await api.unregister(identity);
}

/** Register `pushToken`, proving a rotation with the previous token so the server keeps the owner. */
export async function registerToken(pushToken: string): Promise<Identity> {
  const identity = { deviceId: await getDeviceId(), pushToken },
    previous = await readIdentity();
  await api.register({
    device_id: identity.deviceId,
    push_token: pushToken,
    platform: Platform.OS,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    previous_push_token:
      previous && previous.deviceId === identity.deviceId && previous.pushToken !== pushToken
        ? previous.pushToken
        : null,
  });
  // Saved only once the server accepted it, so a failed rotation can still be proven next time.
  await saveIdentity(identity);
  debug('registered', identity);
  return identity;
}

export async function getExpoPushToken(devicePushToken?: Notifications.DevicePushToken): Promise<string> {
  const projectId =
    getConfig().projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('expo-notifications-client: no EAS projectId; pass `projectId` to configure().');
  const { data } = await Notifications.getExpoPushTokenAsync({
    projectId,
    devicePushToken: devicePushToken ?? (await Notifications.getDevicePushTokenAsync()),
  });
  return data;
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  const { id, name } = getConfig().channel;
  await Notifications.setNotificationChannelAsync(id, { name, importance: Notifications.AndroidImportance.MAX });
}

/** Prompt only if the user has never answered; respect an earlier denial. */
async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}
