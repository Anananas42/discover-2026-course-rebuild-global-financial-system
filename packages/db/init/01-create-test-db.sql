-- The test database: `pnpm test` runs against it so tests never touch the
-- data you create in the bank application.
CREATE DATABASE bank_test;

-- The evaluation database: the course server (apps/dashboard) grades
-- submissions against it, so grading never collides with local test runs.
CREATE DATABASE bank_eval;
