import { useEffect, useState } from 'react';

import { applyTheme, loadTheme, saveTheme } from './theme.ts';
import type { Theme } from './theme.ts';

/** The app's color theme, applied to the document and persisted. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);
  // The cookie is shared across the apps; pick up a toggle made in the
  // other one when this tab regains focus, and on pageshow — navigating
  // back restores the page from the back/forward cache with its old
  // [data-theme] and no focus event, since the window never lost focus.
  useEffect(() => {
    const sync = () => setTheme(loadTheme());
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);
  return [theme, setTheme];
}
