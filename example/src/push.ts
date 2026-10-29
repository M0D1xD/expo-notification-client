import { configure, defineBackgroundTask } from 'expo-notification-client';

// Imported first by index.ts: Android boots the bundle headless for a data-only push and only runs module scope.
configure({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  debug: __DEV__ || process.env.EXPO_PUBLIC_PUSH_DEBUG === '1',
});
defineBackgroundTask();
