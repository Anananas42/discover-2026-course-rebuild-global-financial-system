import { Pencil } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';
import { ThemeToggle } from '@banks/shared/browser/ThemeToggle.tsx';
import { useTheme } from '@banks/shared/browser/use-theme.ts';

import type { GuideState } from '../guide-contract.ts';
import { fetchState } from './api.ts';
import { ErrorAlert } from './components/ErrorAlert.tsx';
import {
  courseConfigured,
  IdentityDialog,
} from './components/IdentityDialog.tsx';
import { ProjectIntro } from './components/ProjectIntro.tsx';
import { SolarStorm } from './components/SolarStorm.tsx';
import { SubmitControls } from './components/SubmitControls.tsx';
import { TaskList } from './components/TaskList.tsx';
import { VscodeTips } from './components/VscodeTips.tsx';

const REFRESH_INTERVAL = 3000;

export function App() {
  const [state, setState] = useState<GuideState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();

  const refresh = useCallback(async () => {
    try {
      setState(await fetchState());
      setConnectionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionError(
        `Cannot reach the guide server (${message}). Is \`pnpm start\` running?`
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <>
      {/* The hero — everything above the Tasks divider — is the story's
          scene: space, and the sun that fired the storm. It forces the
          dark scheme so the tokens inside resolve to their dark side in
          either theme; isolate keeps the canvas's -z-10 inside it. */}
      <div className="relative isolate overflow-hidden text-ink [color-scheme:dark]">
        <SolarStorm />
        {/* The dashboard header's glass, over this page's sky. Like the
            intro panel below, the bar follows the app theme rather than
            the hero's forced dark scheme: the light brand band in light
            mode, dark glass with a text shadow against the sun in dark. */}
        <header className="border-b border-ink/10 bg-brand/80 text-brand-ink backdrop-blur-xl [[data-theme=dark]_&]:text-shadow-md [[data-theme=light]_&]:bg-brand/75 [[data-theme=light]_&]:[color-scheme:light]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-4">
            <h1 className="text-2xl font-semibold">Project Guide</h1>
            {state && (
              <span className="text-brand-ink">
                {[
                  state.course.student,
                  state.course.country,
                  state.course.currency &&
                    `${state.course.currency} (${state.course.decimals} ${
                      state.course.decimals === 1 ? 'decimal' : 'decimals'
                    })`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            {state && courseConfigured(state.course) && (
              <IdentityDialog
                course={state.course}
                onSaved={refresh}
                trigger={open => (
                  <Button
                    title="Edit your financial system's configuration"
                    aria-label="Edit your financial system's configuration"
                    onClick={open}
                  >
                    <Pencil size={16} />
                  </Button>
                )}
              />
            )}
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-6">
          <ErrorAlert error={connectionError} className="my-3" />
          {state && (
            <ProjectIntro
              financialSystemUrl={state.financialSystemUrl}
              course={state.course}
              onSaved={refresh}
            />
          )}
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-6">
        {state && (
          <>
            <TaskList
              stages={state.stages}
              tasks={state.tasks}
              lastRunAt={state.lastRunAt}
              onTestsRan={refresh}
              actions={
                <SubmitControls course={state.course} onSubmitted={refresh} />
              }
            />
            <VscodeTips />
          </>
        )}
      </div>
    </>
  );
}
