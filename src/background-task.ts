import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { debug, getConfig } from './config';
import { findPushData, findRenderContent, type RenderContent } from './payload';
import { track } from './tracking';

export const BACKGROUND_TASK = 'EXPO-NOTIFICATION-CLIENT-BACKGROUND';

const IOS_DISMISS_ACTION = 'com.apple.UNNotificationDismissActionIdentifier';

/**
 * Define and register the background notification task. Call it in the entry file at module scope, after
 * configure(): Android boots the bundle headless for a data-only push and runs only module-scope code.
 */
export function defineBackgroundTask(): void {
  if (TaskManager.isTaskDefined(BACKGROUND_TASK)) return;
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(BACKGROUND_TASK, ({ data, error }) =>
    handleBackgroundNotification(data, error),
  );
  Notifications.registerTaskAsync(BACKGROUND_TASK).catch((error) =>
    console.error('<ERROR!expo-notifications-client> registerTaskAsync', error),
  );
}

/**
 * Data-only pushes arrive here in every app state: show the notification from `data.render`, then record
 * `received`. On Android a tap while the app is in the background arrives here too and is recorded as `opened`.
 */
export async function handleBackgroundNotification(
  data: Notifications.NotificationTaskPayload,
  error: TaskManager.TaskManagerError | null,
): Promise<Notifications.BackgroundNotificationTaskResult> {
  if (error) {
    console.error('<ERROR!expo-notifications-client> background task', error);
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
  if ('actionIdentifier' in data) {
    await track(data.actionIdentifier === IOS_DISMISS_ACTION ? 'dismissed' : 'opened', 'task', data);
    return Notifications.BackgroundNotificationTaskResult.NoData;
  }
  // Show it first: the user-visible part must not wait on the network.
  const render = findRenderContent(data);
  if (render) await present(render, data);
  await track('received', 'task', data);
  return Notifications.BackgroundNotificationTaskResult.NewData;
}

async function present(render: RenderContent, payload: unknown) {
  const { render: _render, ...data } = findPushData(payload) ?? {};
  await Notifications.scheduleNotificationAsync({
    content: {
      title: render.title,
      body: render.body,
      data,
      ...(render.categoryId && { categoryIdentifier: render.categoryId }),
    },
    trigger: { channelId: render.channelId ?? getConfig().channel.id },
  });
  debug('presented', render.title);
}
