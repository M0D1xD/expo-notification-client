import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

/** The device_id + push_token pair the server requires on every request. */
export type Identity = { deviceId: string; pushToken: string };

const IDENTITY_KEY = 'expoNotificationClient.identity';

/** Platform install ID: Android ID, or identifierForVendor on iOS. */
export async function getDeviceId(): Promise<string> {
  const id = Platform.OS === 'android' ? Application.getAndroidId() : await Application.getIosIdForVendorAsync();
  if (!id) throw new Error('expo-notifications-client: no platform install ID available.');
  return id;
}

/** The last pair the server accepted, or null before the first registration. */
export async function readIdentity(): Promise<Identity | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(IDENTITY_KEY)) || 'null');
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  return AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}
