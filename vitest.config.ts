import { defineConfig } from 'vitest/config';

// Two kinds of tests, told apart by name: plain `*.test.ts` are pure —
// no database — and their files run in parallel; `*.int.test.ts` and the
// held-out `*.hidden.test.ts` run against the real Postgres test
// database, which they share, so those files run one after another with
// every test resetting the books. Tests run against the test database so
// they never touch the data created in the financial system application.
// The course server (apps/dashboard) sets EVAL_DATABASE_URL when it
// evaluates submissions, so gradings and local test runs cannot collide.
export default defineConfig({
  test: {
    // Greenfield: there are no tests until the first content package lands.
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          exclude: [
            '**/node_modules/**',
            'student-repo/**',
            '**/*.int.test.ts',
            '**/*.hidden.test.ts',
          ],
          // Plain node tests with no global state between files: skipping
          // the per-file environment isolation (and the process-per-file
          // pool) cuts a full run by about a third.
          pool: 'threads',
          isolate: false,
          // A unit test must never touch a database — a stray connect()
          // fails loudly here instead of reaching the development data.
          env: { DATABASE_URL: 'postgres://unit-tests-use-no-database' },
        },
      },
      {
        test: {
          name: 'integration',
          include: ['**/*.int.test.ts', '**/*.hidden.test.ts'],
          exclude: ['**/node_modules/**', 'student-repo/**'],
          // One shared database — one worker, so the files run
          // sequentially (fileParallelism is root-only and would be
          // ignored here).
          pool: 'threads',
          poolOptions: { threads: { singleThread: true } },
          isolate: false,
          env: {
            DATABASE_URL:
              process.env.EVAL_DATABASE_URL ??
              'postgres://bank:bank@localhost:5433/bank_test',
          },
        },
      },
    ],
  },
});
