// Component state that survives tab switches and reloads via
// localStorage. Used for the persona screens' identity selectors: which
// bank or client you are impersonating is a display preference — like
// the theme, a browser concern, never course state. A stored value that
// no longer matches anything (after a reset, say) is harmless: the
// screens fall back to the first available option.

import { useState } from 'react';

export function useStoredState(key: string): [string, (next: string) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? '');
  const set = (next: string) => {
    setValue(next);
    localStorage.setItem(key, next);
  };
  return [value, set];
}
