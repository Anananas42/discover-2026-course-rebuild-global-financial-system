import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function Section({ title, toolbar, children }: SectionProps) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {toolbar}
      </div>
      {children}
    </section>
  );
}
