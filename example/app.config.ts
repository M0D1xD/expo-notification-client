import type { ConfigContext, ExpoConfig } from 'expo/config';

// Your own EAS project, owner and Android package come from .env.local (see .env.example), so app.json stays generic.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'expo-notification-client example',
  slug: config.slug ?? 'expo-notification-client-example',
  owner: process.env.EXPO_OWNER || config.owner,
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE || config.android?.package,
  },
  extra: {
    ...config.extra,
    eas: { projectId: process.env.EAS_PROJECT_ID || undefined },
  },
});
