import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@banks/shared/browser/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@banks/shared/browser/ui/dialog.tsx';

import type { CourseConfig } from '../../../shared/course-config.ts';
import { IdentityForm } from './IdentityForm.tsx';

export function IdentityDialog({
  course,
  onSaved,
}: {
  course: CourseConfig;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const configured = Boolean(
    course.student && course.country && course.currency
  );

  return (
    <>
      {configured ? (
        <Button
          title="Edit your financial system's configuration"
          aria-label="Edit your financial system's configuration"
          onClick={() => setOpen(true)}
        >
          <Pencil size={16} />
        </Button>
      ) : (
        <button
          className="cursor-pointer rounded-md bg-accent-fill px-4 py-1.5 text-sm font-semibold text-accent-ink hover:brightness-110"
          onClick={() => setOpen(true)}
        >
          initialize your financial system
        </button>
      )}
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
