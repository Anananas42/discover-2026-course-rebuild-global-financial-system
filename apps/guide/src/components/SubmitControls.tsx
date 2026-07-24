import {
  CheckCircle2,
  ClipboardList,
  Send,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@banks/shared/browser/ui/dialog.tsx';

import type { CourseConfig } from '../../../shared/course-defaults.ts';
import { DEFAULT_COURSE_SERVER } from '../../../shared/course-defaults.ts';
import { saveCourse, submitForEvaluation } from '../api.ts';

// Submitting lives in the Tasks toolbar: one button beside "Run tests",
// and a wrench for the rare configuration (which server receives the
// submission — prefilled, explained in its own dialog). The verdict
// opens as a dialog when the evaluation finishes: green with the
// server's output, or red when nothing was recorded. Once a verdict
// exists, a clipboard button reopens the latest one.

export function SubmitControls({
  course,
  onSubmitted,
}: {
  course: CourseConfig;
  onSubmitted: () => void;
}) {
  const [dashboard, setDashboard] = useState(course.dashboard);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; output: string } | null>(
    null
  );
  const [resultOpen, setResultOpen] = useState(false);

  // Same sync rule as IdentityForm: an untouched field follows the server.
  const [prevCourse, setPrevCourse] = useState(course);
  if (course !== prevCourse) {
    setPrevCourse(course);
    if (dashboard === prevCourse.dashboard) setDashboard(course.dashboard);
  }

  const submit = async () => {
    setBusy(true);
    try {
      // Whatever the address field holds is what gets used — saved
      // first, so it also persists for next time.
      await saveCourse({ dashboard });
      setResult(await submitForEvaluation());
    } catch (cause) {
      setResult({
        ok: false,
        output: cause instanceof Error ? cause.message : String(cause),
      });
    }
    setResultOpen(true);
    setBusy(false);
    onSubmitted();
  };

  return (
    <>
      <Button
        disabled={busy}
        onClick={() => void submit()}
        className="px-5 py-2 font-semibold text-accent"
      >
        <Send size={16} aria-hidden />
        {busy ? 'Submitting…' : 'Submit for evaluation'}
      </Button>

      {result && (
        <Button
          className="py-2"
          title="Latest results"
          aria-label="Latest results"
          onClick={() => setResultOpen(true)}
        >
          <ClipboardList
            size={16}
            aria-hidden
            className={result.ok ? 'text-ok' : 'text-danger'}
          />
        </Button>
      )}

      <Dialog
        open={configOpen}
        onOpenChange={open => {
          setConfigOpen(open);
          // Leaving the dialog keeps the typed address.
          if (!open && dashboard !== course.dashboard) {
            void saveCourse({ dashboard });
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            className="py-2"
            title="Submission settings"
            aria-label="Submission settings"
          >
            <Wrench size={16} aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Submitting for evaluation</DialogTitle>
          <DialogDescription>
            Sends your implementation to the course server, which runs the full
            test suite against it — including hidden scenarios stricter than the
            local tests. Your results appear on the classroom board; your own
            test files are never sent.
          </DialogDescription>
          <label className="text-sm font-semibold" htmlFor="course-server">
            Course server
          </label>
          <p className="mt-0.5 mb-1.5 text-xs text-muted">
            Where submissions go — set by the teacher, normally nothing to
            change here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="course-server"
              className="min-w-72 rounded-md border border-line px-3 py-1.5 font-mono text-sm outline-none focus:border-accent"
              placeholder="course server address"
              value={dashboard}
              onChange={e => setDashboard(e.target.value)}
            />
            {dashboard !== DEFAULT_COURSE_SERVER && (
              <Button
                type="button"
                className="text-xs"
                onClick={() => {
                  setDashboard(DEFAULT_COURSE_SERVER);
                  void saveCourse({ dashboard: DEFAULT_COURSE_SERVER });
                }}
              >
                Reset to default
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={result !== null && resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="!max-w-2xl">
          <DialogTitle>
            {result?.ok ? (
              <span className="flex items-center gap-2 text-ok">
                <CheckCircle2 size={18} aria-hidden />
                Submitted — evaluation complete.
              </span>
            ) : (
              <span className="flex items-center gap-2 text-danger">
                <XCircle size={18} aria-hidden />
                Submission failed — nothing was recorded.
              </span>
            )}
          </DialogTitle>
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-line bg-faint px-4 py-3 text-xs whitespace-pre-wrap">
            {result?.output}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
