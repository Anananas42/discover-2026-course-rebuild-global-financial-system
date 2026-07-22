// tRPC client for the financial system API. `AppRouter` is a type-only import of the
// server's router, so every call site is typechecked against the actual
// server contract — drift is a compile error, not a runtime surprise.
// The call-log link records every mutation (see call-log.ts).

import { createTRPCClient, httpBatchLink } from '@trpc/client';

import type { AppRouter } from '../router.ts';
import { callLogLink, setRetryRunner } from './call-log.ts';

export const api = createTRPCClient<AppRouter>({
  links: [callLogLink, httpBatchLink({ url: '/api' })],
});

// A retry re-dispatches a recorded path + input through the same client
// (the client is a proxy, so the path can be walked at runtime); the call
// flows through the link and logs itself, and its outcome surfaces in the
// log — so a rejected retry needs no extra handling here.
setRetryRunner((path, input) => {
  let node: unknown = api;
  for (const segment of path.split('.')) {
    node = (node as Record<string, unknown>)[segment];
  }
  void (node as { mutate: (input: unknown) => Promise<unknown> })
    .mutate(input)
    .catch(() => {});
});
