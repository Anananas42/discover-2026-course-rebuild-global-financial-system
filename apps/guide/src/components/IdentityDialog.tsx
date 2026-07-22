import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@banks/shared/browser/ui/dialog.tsx';

import type { CourseConfig } from '../../../shared/course-config.ts';
import { IdentityForm } from './IdentityForm.tsx';

/** Whether the student has initialized their financial system. */
export const courseConfigured = (course: CourseConfig) =>
  Boolean(course.student && course.country && course.currency);

/** The identity dialog, opened by whatever trigger the call site renders:
 * the header's pencil once configured, the intro's initialize CTA before. */
export function IdentityDialog({
  course,
  onSaved,
  trigger,
}: {
  course: CourseConfig;
  onSaved: () => void;
  trigger: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Your financial system</DialogTitle>
          <DialogDescription>
            Pick the currency once: changing its decimal places later
            reinterprets amounts already stored.
          </DialogDescription>
          <IdentityForm
            course={course}
            onSaved={() => {
              setOpen(false);
              onSaved();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
