// Typed client for the guide API (/api, proxied by the Vite dev server to
// the guide server). Response shapes come from guide-contract.ts — both
// sides import the same types, so they cannot drift apart.

import type { CourseConfig } from '../../shared/course-config.ts';
import type {
  CourseSaved,
  GuideState,
  SubmitOutput,
  TestRun,
} from '../guide-contract.ts';

async function request<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchState = () => request<GuideState>('/api/state');

export const saveCourse = (fields: Partial<CourseConfig>) =>
  request<CourseSaved>('/api/course', post(fields));

/** Runs the public tests — all of them, or one task's scenarios. */
export const runTests = (taskId?: string) =>
  request<TestRun>(
    '/api/run',
    post(taskId === undefined ? undefined : { taskId }),
    150_000
  );

export const submitForEvaluation = () =>
  request<SubmitOutput>('/api/submit', post(), 200_000);
