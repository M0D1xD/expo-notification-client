import { mock } from 'bun:test';

type Listener = (value: never) => void;
type Request = { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> };

/** Mutable state behind the native-module fakes; tests reset it with `resetFakes()`. */
export const fakes = {
  storage: new Map<string, string>(),
  requests: [] as Request[],
  respond: (_request: Request): Response => Response.json({}),
  platform: { OS: 'android' as 'android' | 'ios' },
  appState: { currentState: 'active' as string },
  appStateListener: null as ((state: string) => void) | null,
  permission: { granted: true, canAskAgain: true },
  expoPushToken: 'ExponentPushToken[first]',
  scheduled: [] as Record<string, unknown>[],
  channels: [] as string[],
  listeners: {} as Record<string, Listener>,
  lastResponse: null as unknown,
  clearedLastResponse: 0,
  task: null as ((body: { data: unknown; error: unknown }) => Promise<unknown>) | null,
};

export function resetFakes() {
  fakes.storage.clear();
  fakes.requests = [];
  fakes.respond = () => Response.json({});
  fakes.platform.OS = 'android';
  fakes.appState.currentState = 'active';
  fakes.permission = { granted: true, canAskAgain: true };
  fakes.expoPushToken = 'ExponentPushToken[first]';
  fakes.scheduled = [];
  fakes.channels = [];
  fakes.listeners = {};
  fakes.lastResponse = null;
  fakes.clearedLastResponse = 0;
}

const subscription = (name: string) => (listener: Listener) => {
  fakes.listeners[name] = listener;
  return { remove: () => delete fakes.listeners[name] };
};

globalThis.fetch = (async (url: string, init: RequestInit) => {
  const request = {
    url,
    method: init.method ?? 'GET',
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)),
  };
  fakes.requests.push(request);
  return fakes.respond(request);
}) as typeof fetch;

mock.module('react-native', () => ({
  Platform: fakes.platform,
  AppState: Object.assign(fakes.appState, {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      fakes.appStateListener = listener;
      return { remove: () => (fakes.appStateListener = null) };
    },
  }),
}));

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => fakes.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => void fakes.storage.set(key, value),
  },
}));

mock.module('expo-application', () => ({
  getAndroidId: () => 'android-id',
  getIosIdForVendorAsync: async () => 'ios-vendor-id',
}));

mock.module('expo-device', () => ({ isDevice: true }));

mock.module('expo-constants', () => ({ default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } } }));

mock.module('expo-task-manager', () => ({
  isTaskDefined: () => fakes.task !== null,
  defineTask: (_name: string, task: typeof fakes.task) => void (fakes.task = task),
}));

mock.module('expo-notifications', () => ({
  AndroidImportance: { MAX: 5 },
  BackgroundNotificationTaskResult: { NewData: 1, NoData: 2, Failed: 3 },
  getPermissionsAsync: async () => fakes.permission,
  requestPermissionsAsync: async () => ({ granted: false }),
  setNotificationChannelAsync: async (id: string) => void fakes.channels.push(id),
  getDevicePushTokenAsync: async () => ({ type: 'android', data: 'fcm-token' }),
  getExpoPushTokenAsync: async () => ({ type: 'expo', data: fakes.expoPushToken }),
  scheduleNotificationAsync: async (request: Record<string, unknown>) => void fakes.scheduled.push(request),
  registerTaskAsync: async () => {},
  setNotificationHandler: () => {},
  addNotificationReceivedListener: subscription('received'),
  addNotificationResponseReceivedListener: subscription('response'),
  addPushTokenListener: subscription('pushToken'),
  getLastNotificationResponseAsync: async () => fakes.lastResponse,
  clearLastNotificationResponseAsync: async () => void fakes.clearedLastResponse++,
}));
