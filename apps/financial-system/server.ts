// The financial system API (default port 4330). The React frontend in ./src runs on
// the Vite dev server (port 4323) and proxies /api here (stripping the
// /api prefix); both are started by `pnpm start`.
//
// The API itself is defined in router.ts — this file only hosts it.
//
// Architecture (confirmed, not yet built out): procedures import the
// student's implementation directly — Node runs the TypeScript sources —
// so every operation exercises their real code, and the state lives in the
// PostgreSQL database from docker-compose. Watch mode restarts the server
// on save, which also reloads their code; the data survives because it is
// in the database.

import process from 'node:process';

import { createHTTPServer } from '@trpc/server/adapters/standalone';

import { PORTS } from '../shared/ports.ts';
import { appRouter } from './router.ts';

const PORT = Number(process.env.PORT ?? PORTS.financialSystemApi);

createHTTPServer({ router: appRouter }).listen(PORT, '127.0.0.1', () => {
  console.log(`Financial system running at http://localhost:${PORT}`);
});
