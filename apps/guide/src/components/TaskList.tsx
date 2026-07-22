import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleCheck,
  FlaskConical,
  Lightbulb,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { CurriculumStage } from '../../../shared/curriculum.ts';
import type { GuideTask, TaskStatus } from '../../guide-contract.ts';
import { runTests } from '../api.ts';
import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@banks/shared/browser/ui/collapsible.tsx';
import { allCuriositiesRead, useReadCuriosities } from './Curiosities.tsx';
import { ErrorAlert } from './ErrorAlert.tsx';
import { Section } from './Section.tsx';
import { TaskCard } from './TaskCard.tsx';

// Tasks grouped by curriculum stage, in teaching order. At any moment
// the stages split into done, one in progress, and not yet started — and
// only the in-progress one needs full detail, so it alone is expanded;
// the rest collapse to a one-line summary (click to peek). Implementing
// a task also reveals its operation in the financial system, so the
// stage a student is on is visible in both places at once.

// One dot per task in an unfinished stage's header, in task order: green
// once passing, amber while in progress, line-gray untouched — how far
// along a collapsed stage is, at a glance. A complete stage shows the
// checkmark instead; all-green dots next to it would say nothing new.
const DOT_CLASS: Record<TaskStatus, string> = {
  'not-started': 'bg-line',
  'in-progress': 'bg-warn',
  passing: 'bg-ok',
};

/** One slice of a stage's rail: green while the passing streak from the
 * top holds, the quiet line color after it breaks. transition-colors so
 * a segment turns green in place when tests pass mid-session. */
const railSegment = (passed: boolean) =>
  `border-l-2 pl-5 transition-colors ${passed ? 'border-ok/60' : 'border-line/60'}`;

/** The stage pill's sticky wrapper, which knows whether it is currently
 * pinned to the viewport top. CSS has no :stuck selector, so a
 * zero-height sentinel marks the wrapper's natural resting place: the
 * wrapper is pinned exactly while the sentinel sits scrolled out above
 * the viewport. Pinned state is exposed as data-stuck for the pill's
 * corner styling. */
function StickyStagePill({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.at(-1);
      if (!entry) return;
      // Above the viewport means pinned; below (stage not yet reached)
      // is also non-intersecting but not pinned.
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div
        data-stuck={stuck || undefined}
        className="group sticky top-0 z-10 bg-page pt-3"
      >
        {children}
      </div>
    </>
  );
}

interface TaskListProps {
  stages: CurriculumStage[];
  tasks: GuideTask[];
  lastRunAt: number | null;
  onTestsRan: () => void;
  /** Extra toolbar controls — the submit button and its settings. */
  actions?: ReactNode;
}

export function TaskList({
  stages,
  tasks,
  lastRunAt,
  onTestsRan,
  actions,
}: TaskListProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which stages are expanded. Decided once, when the data first
  // arrives: only the then-current stage open. After that the state
  // belongs to the student — completing a stage updates its pill in
  // place, it never collapses or opens anything under their eyes; the
  // fresh defaults apply on the next page load.
  const [opens, setOpens] = useState<Record<number, boolean> | null>(null);
  // Each stage collapsible's root element, for the close-while-stuck
  // scroll correction in onOpenChange.
  const stageEls = useRef(new Map<number, HTMLDivElement>());

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      await runTests();
    } catch (cause) {
      setError(
        `Test run failed: ${cause instanceof Error ? cause.message : String(cause)}`
      );
    }
    setRunning(false);
    onTestsRan();
  };

  const readCuriosities = useReadCuriosities();
  const stageTasks = (stage: CurriculumStage) =>
    tasks.filter(task => task.stage === stage.stage);
  const isComplete = (stage: CurriculumStage) =>
    stageTasks(stage).every(task => task.status === 'passing');

  // The first stage with unfinished work is where the student is now.
  const currentStage = stages.find(stage => !isComplete(stage))?.stage;

  // The first incomplete task in teaching order — the one to work on
  // next; its card highlights the implement button.
  const nextTaskId = stages
    .flatMap(stage => stageTasks(stage))
    .find(task => task.status !== 'passing')?.id;

  // The toolbar button collapses everything — or, once everything is
  // collapsed, expands everything.
  const anyOpen = stages.some(
    stage => opens?.[stage.stage] ?? stage.stage === currentStage
  );

  useEffect(() => {
    if (opens !== null || tasks.length === 0) return;
    const defaults: Record<number, boolean> = {};
    for (const stage of stages) {
      defaults[stage.stage] = stage.stage === currentStage;
    }
    setOpens(defaults);
  }, [opens, tasks.length, stages, currentStage]);

  return (
    <Section
      title="Tasks"
      toolbar={
        // items-center, not baseline: buttons whose first child is an
        // icon would otherwise align by the SVG's bottom edge.
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>
            {lastRunAt
              ? `tests last run ${new Date(lastRunAt).toLocaleTimeString()}`
              : 'tests not run yet'}
          </span>
          <Button
            className="py-2"
            onClick={() =>
              setOpens(
                Object.fromEntries(stages.map(stage => [stage.stage, !anyOpen]))
              )
            }
          >
            {anyOpen ? (
              <ChevronsDownUp size={15} aria-hidden />
            ) : (
              <ChevronsUpDown size={15} aria-hidden />
            )}
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button
            disabled={running}
            className="py-2"
            onClick={() => void run()}
          >
            <FlaskConical size={15} aria-hidden />
            {running ? 'Running…' : 'Run tests'}
          </Button>
          {actions}
        </div>
      }
    >
      <ErrorAlert error={error} className="mb-3" />
      {stages.map(stage => {
        const own = stageTasks(stage);
        if (own.length === 0) return null;
        const complete = isComplete(stage);
        const curiositiesRead = allCuriositiesRead(
          own.map(task => task.id),
          readCuriosities
        );
        const current = stage.stage === currentStage;
        // A stage with any evidence of work — a passing or in-progress
        // task — is honestly "in progress" even when the active front
        // (the first incomplete stage) is elsewhere, e.g. after a
        // regression in an earlier stage.
        const started =
          current || own.some(task => task.status !== 'not-started');
        const open = opens?.[stage.stage] ?? current;
        // How far the green rail reaches: the unbroken run of passing
        // tasks from the top. Tasks 1 2 3 passing → green through 3;
        // 1 and 3 passing but not 2 → green through 1 only.
        const firstGap = own.findIndex(task => task.status !== 'passing');
        const passedPrefix = firstGap === -1 ? own.length : firstGap;
        return (
          <Collapsible
            key={stage.stage}
            ref={el => {
              if (el) stageEls.current.set(stage.stage, el);
              else stageEls.current.delete(stage.stage);
            }}
            open={open}
            onOpenChange={next => {
              setOpens(prev => ({ ...prev, [stage.stage]: next }));
              // Closing a stage whose pill is stuck would strand the
              // viewport deep in content that is about to vanish. Snap
              // the scroll so the top of the screen lands where the
              // stage begins — the pill itself doesn't visibly move,
              // everything under it folds away. Measured before the
              // collapse renders; nothing above the stage changes, so
              // the position is already final.
              if (!next) {
                const top = stageEls.current
                  .get(stage.stage)
                  ?.getBoundingClientRect().top;
                if (top !== undefined && top < 0) window.scrollBy({ top });
              }
            }}
          >
            {/* The pill sticks to the viewport top while its stage
                scrolls, so the student always sees which stage they are
                in. The wrapper (not the button) is sticky and carries
                the page background with the pill's former mt-3 as
                padding: an opaque band, so content sliding underneath
                doesn't show through the gap or the rounded corners.
                Sticky bottoms out at its parent — the next stage's pill
                pushes this one away naturally. While pinned, the pill's
                bottom-right corner squares off: the task cards sliding
                underneath reach its right edge, and the rounded corner
                would notch into them (the left corner sits clear — the
                cards are indented past it). */}
            <StickyStagePill>
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 text-left group-data-[stuck]:rounded-br-none hover:border-current/40">
                <ChevronRight
                  size={18}
                  className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
                  aria-hidden
                />
                <h3 className="flex-1 text-base font-semibold">
                  <span className="mr-3 text-muted">Stage {stage.stage}</span>
                  {stage.title}
                </h3>
                {curiositiesRead !== null && (
                  <Lightbulb
                    size={18}
                    className={curiositiesRead ? 'text-warn' : 'text-muted'}
                    aria-label={
                      curiositiesRead
                        ? 'curiosities read'
                        : 'curiosities to read'
                    }
                  />
                )}
                {complete ? (
                  <CircleCheck
                    size={20}
                    className="text-ok"
                    aria-label="completed"
                  />
                ) : (
                  <span
                    role="img"
                    aria-label={`${own.filter(task => task.status === 'passing').length} of ${own.length} tasks passing`}
                    className="flex items-center gap-1.5"
                  >
                    {own.map(task => (
                      <span
                        key={task.id}
                        className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[task.status]}`}
                      />
                    ))}
                  </span>
                )}
                {!complete && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      started
                        ? 'border-warn text-warn'
                        : 'border-line text-muted'
                    }`}
                  >
                    {started ? 'in progress' : 'not started'}
                  </span>
                )}
              </CollapsibleTrigger>
            </StickyStagePill>
            <CollapsibleContent>
              {/* The rail: a vertical line dropping from under the stage
                  pill's chevron (px-5 + half the 18px icon, minus half its
                  own 2px width = 28px), tying the expanded content to the
                  pill it belongs to. It doubles as a progress thread: each
                  child carries its own segment of the line, green from the
                  pill down through the unbroken run of passing tasks from
                  the top, quiet after the first gap. Spacing between cards
                  is padding on the segments (not card margins), which
                  would collapse through the wrappers and break the line. */}
              <div className="ml-[28px]">
                {stage.outcome && (
                  <div className={railSegment(passedPrefix > 0)}>
                    <p className="pt-2.5 text-sm text-muted">
                      When this works: {stage.outcome}
                    </p>
                  </div>
                )}
                {own.map((task, index) => (
                  <div
                    key={task.id}
                    className={`pt-4 ${railSegment(index < passedPrefix)}`}
                  >
                    <TaskCard
                      task={task}
                      next={task.id === nextTaskId}
                      onTestsRan={onTestsRan}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </Section>
  );
}
