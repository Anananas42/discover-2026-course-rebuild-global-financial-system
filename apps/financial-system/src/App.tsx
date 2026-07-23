import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';

import { Button } from '@banks/shared/browser/Button.tsx';
import { ThemeToggle } from '@banks/shared/browser/ThemeToggle.tsx';
import { useTheme } from '@banks/shared/browser/use-theme.ts';
import { PORTS } from '@banks/shared/ports.ts';

import { api } from './api.ts';
import { subscribeMutations } from './call-log.ts';
import { visibleTabs } from './gating.ts';
import { CentralBankScreen } from './components/CentralBankScreen.tsx';
import { CommercialBankScreen } from './components/CommercialBankScreen.tsx';
import { DatabaseScreen } from './components/DatabaseScreen.tsx';
import { InterbankScreen } from './components/InterbankScreen.tsx';
import { LogScreen } from './components/LogScreen.tsx';
import { TAB_IDS, TabBar, type TabId } from './components/TabBar.tsx';
import { UserScreen } from './components/UserScreen.tsx';

// The workbench: three persona screens (who you are acting as) plus the
// two tool surfaces, in tabs. One refetch rule for the whole app: after
// any mutation settles — and on window focus, since saving code changes
// behavior without a click — `version` bumps and every screen refetches
// everything. Data is toy-sized; staleness must never be a debugging
// variable.
//
// Each tab lives at its own URL (/database, /log, …): the guide
// deep-links straight into a view, a reload stays where it was, and
// back/forward walk the visited tabs.

type Config = Awaited<ReturnType<typeof api.config.query>>;

/** The tab a URL names, `/database` → 'database'; null off the map. */
function tabFromLocation(): TabId | null {
  const segment = window.location.pathname.split('/')[1] ?? '';
  return (TAB_IDS as string[]).includes(segment) ? (segment as TabId) : null;
}

export function App() {
  const [theme, setTheme] = useTheme();
  const [tab, setTab] = useState<TabId>(
    () => tabFromLocation() ?? 'central-bank'
  );
  const [config, setConfig] = useState<Config | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(current => current + 1), []);

  useEffect(() => subscribeMutations(bump), [bump]);
  useEffect(() => {
    window.addEventListener('focus', bump);
    return () => window.removeEventListener('focus', bump);
  }, [bump]);

  // Selecting a tab records it in the URL; back/forward replay it.
  const select = useCallback((next: TabId) => {
    window.history.pushState(null, '', `/${next}`);
    setTab(next);
  }, []);
  useEffect(() => {
    const onPopState = () => setTab(current => tabFromLocation() ?? current);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.config
      .query()
      .then(next => {
        if (cancelled) return;
        setConfig(next);
        setConnectionError(false);
      })
      .catch(() => {
        if (!cancelled) setConnectionError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Which tabs exist follows the unlocked tasks; if the remembered
  // tab is not among them (fresh database, early curriculum), fall back
  // to the first visible one.
  const tabs = config ? visibleTabs(config.tasks) : [];
  const shown = tabs.includes(tab) ? tab : tabs[0];

  return (
    <>
      <header className="bg-brand text-brand-ink">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Button
            href={`http://localhost:${PORTS.guide}`}
            title="Back to the project guide"
            aria-label="Back to the project guide"
          >
            <ArrowLeft size={16} />
          </Button>
          <h1 className="text-2xl font-semibold">Financial System</h1>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>
      {config && shown && (
        <TabBar active={shown} visible={tabs} onChange={select} />
      )}
      <main className="mx-auto max-w-6xl px-6 py-6">
        {connectionError && (
          <p className="mb-4 text-danger">
            Cannot reach the financial system server — is `pnpm start` running?
          </p>
        )}
        {config && (
          <>
            {shown === 'central-bank' && (
              <CentralBankScreen version={version} config={config} />
            )}
            {shown === 'commercial-bank' && (
              <CommercialBankScreen version={version} config={config} />
            )}
            {shown === 'people' && (
              <UserScreen version={version} config={config} />
            )}
            {shown === 'interbank-api' && <InterbankScreen version={version} />}
            {shown === 'database' && (
              <DatabaseScreen version={version} config={config} />
            )}
            {shown === 'log' && <LogScreen />}
          </>
        )}
      </main>
      {/* --width sizes sonner's toast slots; the toast body matches it. */}
      <Toaster
        position="top-center"
        gap={8}
        style={{ '--width': '560px' } as React.CSSProperties}
      />
    </>
  );
}
