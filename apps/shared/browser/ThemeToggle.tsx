import { Moon, Sun } from 'lucide-react';

import type { Theme } from './theme.ts';
import { Button } from './Button.tsx';

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  return (
    <Button
      className="ml-auto"
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
      onClick={() => onChange(next)}
    >
      {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
