import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@banks/shared/browser/Button.tsx';

import type { CourseConfig } from '../../../shared/course-config.ts';
import { saveCourse } from '../api.ts';
import { ErrorAlert } from './ErrorAlert.tsx';

const inputClass =
  'w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-accent';

export function IdentityForm({
  course,
  onSaved,
}: {
  course: CourseConfig;
  onSaved: () => void;
}) {
  const [student, setStudent] = useState(course.student);
  const [country, setCountry] = useState(course.country);
  const [currency, setCurrency] = useState(course.currency);
  const [decimals, setDecimals] = useState(String(course.decimals));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveCourse({
        student,
        country,
        currency,
        decimals: Number(decimals),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    setSaving(false);
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input
        className={inputClass}
        placeholder="your name"
        value={student}
        onChange={e => setStudent(e.target.value)}
        required
      />
      <input
        className={inputClass}
        placeholder="your country"
        value={country}
        onChange={e => setCountry(e.target.value)}
        required
      />
      <input
        className={inputClass}
        placeholder="currency, e.g. CZK"
        maxLength={5}
        value={currency}
        onChange={e => setCurrency(e.target.value)}
        required
      />
      <input
        className={inputClass}
        type="number"
        min={0}
        max={4}
        placeholder="decimals"
        title="Decimal places of your currency: 2 for CZK (cents), 0 for JPY"
        value={decimals}
        onChange={e => setDecimals(e.target.value)}
        required
      />
      <ErrorAlert error={error} />
      <Button disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
