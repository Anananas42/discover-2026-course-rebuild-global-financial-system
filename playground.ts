// Scratch file for local experiments. Run with `pnpm play`. It is not part
// of any submission, but the data it writes is real.
//
// Debugging workflow: add `yield* Effect.log(...)` anywhere and watch the
// execution trace.

import { connect } from '@banks/db/database.ts';
import { Effect } from 'effect';

const db = await connect();

const program = Effect.gen(function* () {
  yield* Effect.log('Playground started');

  // Experiment below.
});

await Effect.runPromise(program);
await db.destroy();
