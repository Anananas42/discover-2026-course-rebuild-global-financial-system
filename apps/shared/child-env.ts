// Environment for child processes spawned by the app servers. When a
// server runs under `node --watch` (the guide and the dashboard both
// do), the watcher's IPC variables must not leak to children — a child
// inheriting NODE_CHANNEL_FD tries to attach to an IPC channel it does
// not have and dies on startup.

import process from 'node:process';

export function childEnv(
  extra: Record<string, string> = {}
): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  delete env.NODE_CHANNEL_FD;
  delete env.NODE_UNIQUE_ID;
  delete env.WATCH_REPORT_DEPENDENCIES;
  return env;
}
