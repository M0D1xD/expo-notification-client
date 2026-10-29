export type ClientConfig = {
  /** Base URL of the Laravel app that has m0d1xd/expo-notification installed, e.g. `https://api.example.com`. */
  apiUrl: string;
  /** The package's route prefix (`routes.prefix` in config/expo-notification.php). */
  prefix?: string;
  /** Android channel the SDK creates and shows notifications on. */
  channel?: { id: string; name: string };
  /** Extra request headers, e.g. the signed-in user's bearer token so the server assigns the device to them. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** EAS project id; read from the app config when omitted. */
  projectId?: string;
  /** Show notifications while the app is in the foreground. */
  showInForeground?: boolean;
  /** Log `<DEBUG!push>` lines. */
  debug?: boolean;
};

export type ResolvedConfig = Required<Omit<ClientConfig, 'headers' | 'projectId'>> &
  Pick<ClientConfig, 'headers' | 'projectId'>;

let current: ResolvedConfig | null = null;

/** Call once in the app's entry file, at module scope: the headless background task needs it too. */
export function configure(config: ClientConfig): void {
  current = {
    prefix: 'expo-notification',
    channel: { id: 'default', name: 'Default' },
    showInForeground: true,
    debug: false,
    ...config,
    apiUrl: config.apiUrl.replace(/\/+$/, ''),
  };
}

export function getConfig(): ResolvedConfig {
  if (!current) throw new Error('expo-notification-client: call configure() before using the SDK.');
  return current;
}

export function debug(...args: unknown[]) {
  if (current?.debug) console.log('<DEBUG!push>', ...args);
}
