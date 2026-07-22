// The color theme — a browser concern, stored in a cookie so the guide and
// financial system frontends (same host, different ports) see one shared
// value; localStorage would be per-port. There is no "system" option: the
// OS preference manifests only as the initial value on first visit; from
// then on the choice is explicit and forced via [data-theme] (see
// ../../shared/theme.css).

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const COOKIE_NAME = 'theme';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The stored preference, or the OS preference on first visit. */
export function loadTheme(): Theme {
  const stored = document.cookie
    .split('; ')
    .find(entry => entry.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if ((THEMES as readonly string[]).includes(stored ?? '')) {
    return stored as Theme;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: Theme): void {
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
