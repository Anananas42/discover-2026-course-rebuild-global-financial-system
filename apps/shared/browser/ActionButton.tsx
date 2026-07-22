import type { ComponentProps } from 'react';

import { Button } from './Button.tsx';

// The do-something button: the brand-yellow wash and shadow lift set the
// operation triggers apart from the apps' plain chrome buttons.

export function ActionButton(props: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={`bg-action-fill font-medium text-action-ink shadow-md ${props.className ?? ''}`}
    />
  );
}
