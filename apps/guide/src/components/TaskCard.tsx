import {
  Check,
  ChevronRight,
  CircleCheck,
  FlaskConical,
  Lightbulb,
  SquarePen,
} from 'lucide-react';
import { useState } from 'react';

import { runTests } from '../api.ts';

import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';

import type { FileLink, GuideTask, TaskStatus } from '../../guide-contract.ts';
import { vscodeHref } from '../vscode-link.ts';
import { CONCEPTS_BY_TASK, ConceptExplainer } from './ConceptExplainers.tsx';
import {
  allCuriositiesRead,
  CURIOSITIES_BY_TASK,
  Curiosity,
  useReadCuriosities,
} from './Curiosities.tsx';

// One task = one story, two buttons, details on demand. The whole card
// collapses to its header row (only the next task and in-progress work
// start open — decided once, never moved under the student's eyes).
// Expanded: the
// story is the task prompt — full ink, body size, the card's main text,
// everything else supports it; the two calls to action are where the work
// happens (the filled goto button) and running this task's tests (the
// quiet button beside it, the test file's path in small print
// underneath — rarely needed, nice to see). The open card is three
// bands under a title bar: the narrative (story and steps, tight
// rhythm), the action row (extra air above), and the depth band —
// test-result and context disclosures with curiosities lying open
// beneath, pushed well clear so it reads as an appendix.

const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': 'not started',
  'in-progress': 'in progress',
  passing: 'passing',
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  'not-started': 'border-line text-muted',
  'in-progress': 'border-warn text-warn',
  passing: 'border-ok text-ok',
};

/** A file in the disclosure: full path, then what it is about. */
function FileRow({ file, about }: { file: FileLink; about?: string }) {
  return (
    <div>
      <a
        className="font-mono text-sm hover:underline"
        href={vscodeHref(file.abs, file.line)}
      >
        {file.path}
        {file.line ? `:${file.line}` : ''}
      </a>
      {(about ?? file.description) && (
        <div className="text-sm text-muted">{about ?? file.description}</div>
      )}
    </div>
  );
}

export function TaskCard({
  task,
  next,
  onTestsRan,
}: {
  task: GuideTask;
  /** Whether this is the next incomplete task — the one to work on. */
  next?: boolean;
  onTestsRan: () => void;
}) {
  const [filesOpen, setFilesOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // Decided once, on first render: only the next task and tasks with
  // work in progress start open — on a fresh visit that is a single
  // card, not the whole first stage. After that the card never moves on
  // its own — passing mid-session updates the pill in place (same rule
  // as the stage sections).
  const [open, setOpen] = useState(() => next || task.status === 'in-progress');
  const curiositiesRead = allCuriositiesRead([task.id], useReadCuriosities());
  const gotoName = task.implement.path.split('/').pop() ?? task.implement.path;

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      await runTests(task.id);
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : String(cause));
    }
    setRunning(false);
    onTestsRan();
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      // No padding here: the trigger carries it, so the whole pill is
      // the click target and — while collapsed — hovers like a stage
      // bar; expanded, the card is a container, not a button. No margin
      // either: the stage rail segment in TaskList owns the spacing, so
      // the rail's color runs unbroken through the gaps between cards.
      className={`block rounded-xl border border-line bg-surface ${open ? '' : 'hover:border-current/40'}`}
    >
      {/* While open, a hairline under the row turns it into the card's
          title bar — without it the title reads as the first line of the
          body and the card feels like a stretched pill. */}
      <CollapsibleTrigger
        className={`flex w-full cursor-pointer flex-wrap items-baseline gap-3 px-6 py-4 text-left ${open ? 'border-b border-line' : ''}`}
      >
        <ChevronRight
          size={15}
          className={`self-center text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className="font-mono text-sm text-muted tabular-nums">
          {task.id}
        </span>
        <span className="flex-1 text-[15px] font-semibold">{task.title}</span>
        {curiositiesRead !== null && (
          <Lightbulb
            size={17}
            className={`self-center ${curiositiesRead ? 'text-warn' : 'text-muted'}`}
            aria-label={
              curiositiesRead ? 'curiosities read' : 'curiosities to read'
            }
          />
        )}
        {task.status === 'passing' ? (
          <CircleCheck
            size={18}
            className="self-center text-ok"
            aria-label="passing"
          />
        ) : (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_CLASS[task.status]}`}
          >
            {STATUS_LABEL[task.status]}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-6 pt-4 pb-5">
        {/* The story is the card's one piece of true prose — it reads at
            full body size (16px), a step above the 15px UI voice, while
            the section labels drop to small caps. Size now separates
            "read this" from "operate this". */}
        {task.story && (
          <p className="text-base leading-relaxed">{task.story}</p>
        )}

        {/* Stage-0 tasks teach a concept right where it is applied: the
            explainer card sits between the prompt and the steps. */}
        {CONCEPTS_BY_TASK[task.id] && (
          <div className="mt-3 grid gap-3">
            {CONCEPTS_BY_TASK[task.id]?.map(id => (
              <ConceptExplainer key={id} id={id} />
            ))}
          </div>
        )}

        {task.steps.length > 0 && (
          <>
            <p className="mt-4 text-xs font-semibold tracking-wider text-muted uppercase">
              Walk it by hand
            </p>
            <ol className="mt-1 list-decimal space-y-1 pl-6 text-sm leading-relaxed marker:text-muted">
              {task.steps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        )}

        {/* The action row is the card's center of gravity: extra air
            above separates it from the narrative band. */}
        <div className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-2">
          {/* Accent text, not accent fill: sixteen filled buttons down a
              page strain the eye; the color alone marks the primary. On
              the next incomplete task only, a soft glow in the vivid
              brand yellow — the initialize CTA's color — points at where
              the work continues. */}
          <Button
            href={vscodeHref(task.implement.abs, task.implement.line)}
            className={`font-semibold text-accent ${next ? 'shadow-[0_0_8px] shadow-brand-vivid/60' : ''}`}
          >
            <SquarePen size={15} aria-hidden />
            {/* One span: the sans label and the mono file name share an
                inline baseline instead of being separately flex-centered. */}
            <span>
              Implement in{' '}
              <span className="font-mono">
                {gotoName}
                {task.implement.line ? `:${task.implement.line}` : ''}
              </span>
            </span>
          </Button>
          {task.tests && (
            <span className="flex flex-col gap-1">
              {/* The button carries the verdict: once the task passes it
                turns green with a checkmark — clicking re-runs either way. */}
              <Button
                disabled={running}
                onClick={() => void run()}
                className={task.status === 'passing' ? 'text-ok' : ''}
              >
                {task.status === 'passing' ? (
                  <Check size={15} aria-hidden />
                ) : (
                  <FlaskConical size={15} aria-hidden />
                )}
                {running
                  ? 'Running…'
                  : task.status === 'passing'
                    ? 'Tests passing'
                    : 'Run the tests'}
              </Button>
              <a
                className="font-mono text-[11px] text-muted hover:text-ink hover:underline"
                href={vscodeHref(task.tests.abs, task.tests.line)}
              >
                {task.tests.path}
                {task.tests.line ? `:${task.tests.line}` : ''}
              </a>
            </span>
          )}
        </div>
        {runError && (
          <p className="mt-2 text-sm text-danger">
            Test run failed: {runError}
          </p>
        )}

        {/* The depth band: everything below the actions is optional —
            test results, context files, curiosities. One group, pushed
            well clear of the buttons, so it reads as the card's appendix
            rather than more task. */}
        {(task.scenarios.length > 0 ||
          task.context.length > 0 ||
          CURIOSITIES_BY_TASK[task.id]) && (
          <div className="mt-6">
            {task.scenarios.length > 0 && (
              <Collapsible open={testsOpen} onOpenChange={setTestsOpen}>
                <CollapsibleTrigger className="flex cursor-pointer items-baseline gap-1 text-xs font-semibold tracking-wider text-muted uppercase hover:text-ink">
                  <ChevronRight
                    size={13}
                    className={`self-center transition-transform ${testsOpen ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  tests
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 ml-5 border-l border-line pl-4 text-sm">
                    {task.ranAt !== null && (
                      <div className="mb-1 text-[11px] text-muted">
                        checked at {new Date(task.ranAt).toLocaleTimeString()}
                      </div>
                    )}
                    {task.scenarios.map(scenario => (
                      <div
                        key={scenario.name}
                        className="flex items-baseline gap-2"
                      >
                        <span
                          className={
                            scenario.status === 'passed'
                              ? 'text-ok'
                              : 'text-warn'
                          }
                        >
                          {scenario.status === 'passed' ? '✓' : '✗'}
                        </span>
                        <span>
                          {scenario.name}
                          {scenario.error && (
                            <div className="text-xs text-muted">
                              {scenario.error}
                            </div>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {task.context.length > 0 && (
              <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
                <CollapsibleTrigger
                  className={`flex cursor-pointer items-baseline gap-1 text-xs font-semibold tracking-wider text-muted uppercase hover:text-ink ${task.scenarios.length > 0 ? 'mt-2.5' : ''}`}
                >
                  <ChevronRight
                    size={13}
                    className={`self-center transition-transform ${filesOpen ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  context
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 ml-5 flex flex-col gap-2.5 border-l border-line pl-4">
                    {task.context.map(file => (
                      <FileRow key={file.path} file={file} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            {CURIOSITIES_BY_TASK[task.id] && (
              <div
                className={`grid gap-3 ${task.scenarios.length > 0 || task.context.length > 0 ? 'mt-3' : ''}`}
              >
                {CURIOSITIES_BY_TASK[task.id]?.map(id => (
                  <Curiosity key={id} id={id} />
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
