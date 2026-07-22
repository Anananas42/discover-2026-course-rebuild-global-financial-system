import type { ReactNode } from 'react';

// One labeled form field, used by every operation dialog — the uniform
// look is what makes a new dialog a copy-paste of its neighbor.

export const INPUT_CLASS =
  'w-full rounded-md border border-line bg-page px-3 py-2 text-sm';

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Groups fields that belong to one role in the operation — "From",
 *  "To" — so the form reads as parties, not as a flat list of rows. */
export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-lg border border-line bg-surface px-4 pt-1.5 pb-4">
      <legend className="px-1.5 text-xs font-semibold tracking-wider text-ink uppercase">
        {label}
      </legend>
      <div className="flex flex-col gap-3.5">{children}</div>
    </fieldset>
  );
}
