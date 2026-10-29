/** What the server puts in `data.render` for a data-only push the app shows itself. */
export type RenderContent = { title: string; body: string; channelId?: string; categoryId?: string };

/**
 * Find the `notificationId` the server put in `data`, wherever the platform delivered it: in a notification
 * response, as a plain key, or inside JSON strings such as `dataString` or `body` (headless Android payloads).
 * Returns null when the push carries none.
 */
export function findNotificationId(payload: unknown): string | null {
  const id = findPushData(payload)?.notificationId;
  return typeof id === 'string' && id ? id : null;
}

/** The push's `data` object: the one carrying `notificationId`, parsed out of JSON strings when needed. */
export function findPushData(payload: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || payload == null) return null;
  if (typeof payload === 'string') {
    if (!payload.includes('notificationId')) return null;
    try {
      return findPushData(JSON.parse(payload), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.notificationId === 'string' && record.notificationId) return record;
  for (const value of Object.values(record)) {
    const found = findPushData(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Content the background task should show for a data-only push, or null when there is nothing to show. */
export function findRenderContent(payload: unknown): RenderContent | null {
  const render = findPushData(payload)?.render;
  if (!render || typeof render !== 'object') return null;
  const { title, body, channelId, categoryId } = render as Record<string, unknown>;
  if (typeof title !== 'string') return null;
  return {
    title,
    body: typeof body === 'string' ? body : '',
    ...(typeof channelId === 'string' && { channelId }),
    ...(typeof categoryId === 'string' && { categoryId }),
  };
}
