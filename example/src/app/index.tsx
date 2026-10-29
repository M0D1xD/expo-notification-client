import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNotificationTracking } from '@/hooks/use-notification-tracking';
import type { TrackedEvent } from 'expo-notification-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export default function TrackingScreen() {
  const { identity, error, lastOpened, pending, history, register, logout, unregister, flush, refresh } =
    useNotificationTracking();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">expo-notification-client</ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Row label="API" value={API_URL || 'EXPO_PUBLIC_API_URL not set'} />
            <Row label="Device ID" value={identity?.deviceId ?? '—'} />
            <Row label="Push token" value={identity?.pushToken ?? '—'} />
            {lastOpened && <Row label="Last opened data" value={JSON.stringify(lastOpened)} />}
            {error && <ThemedText themeColor="textSecondary">Error: {error}</ThemedText>}
            <ThemedView type="backgroundElement" style={styles.actions}>
              <Button label="Register" onPress={register} />
              <Button
                label="Copy token"
                onPress={() => identity && Clipboard.setStringAsync(identity.pushToken)}
              />
              <Button label="Logout" onPress={logout} />
              <Button label="Unregister" onPress={unregister} />
              <Button label="Flush" onPress={flush} />
              <Button label="Refresh" onPress={refresh} />
            </ThemedView>
          </ThemedView>

          <EventList title={`Queued (${pending.length})`} events={pending} />
          <EventList title={`Sent (${history.length})`} events={history} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement">
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="code" selectable>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundSelected" style={styles.button}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function EventList({ title, events }: { title: string; events: TrackedEvent[] }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {events.length === 0 && <ThemedText themeColor="textSecondary">None</ThemedText>}
      {events.map((e) => (
        <ThemedText key={`${e.notificationId}:${e.type}`} type="code">
          {e.at.slice(11, 19)} {e.type.padEnd(9)} {e.source.padEnd(10)} {e.appState.padEnd(10)}{' '}
          {e.notificationId}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
