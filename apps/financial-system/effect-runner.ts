// Bridges the domain's Effect signatures to tRPC procedures: runs the
// effect, and turns its two failure channels into the two TRPCError codes
// the error formatter classifies — expected domain failures become
// BAD_REQUEST with the tagged error as cause, defects (including
// NotImplementedError from task stubs) become INTERNAL_SERVER_ERROR with
// the original error as cause.

import { TRPCError } from '@trpc/server';
import { Cause, Effect, Exit, Option } from 'effect';

export async function runEffect<A, E extends Error>(
  effect: Effect.Effect<A, E>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: failure.value.message,
      cause: failure.value,
    });
  }
  const defect = Cause.dieOption(exit.cause);
  const cause =
    Option.isSome(defect) && defect.value instanceof Error
      ? defect.value
      : new Error(Cause.pretty(exit.cause));
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: cause.message,
    cause,
  });
}
