// Client side of the error envelope: digs the classified outcome out of a
// failed call. Every failure the server produced carries `data.outcome`
// (see ../error-outcome.ts); anything else — typically the server not
// running at all — is a defect with the raw message.

import { TRPCClientError } from '@trpc/client';

import type { Outcome } from '../error-outcome.ts';

export function outcomeOf(error: unknown): Outcome {
  if (error instanceof TRPCClientError) {
    const data = error.data as { outcome?: Outcome } | null;
    if (data?.outcome) return data.outcome;
  }
  return {
    kind: 'defect',
    message: error instanceof Error ? error.message : String(error),
  };
}
