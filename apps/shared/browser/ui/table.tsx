import type { ComponentProps } from 'react';

// shadcn-style table: plain semantic <table> elements styled with the
// shared tokens, so columns actually align. The wrapper scrolls
// horizontally on narrow screens instead of breaking the layout.

export function Table({ className = '', ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table {...props} className={`w-full text-sm ${className}`} />
    </div>
  );
}

export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

export function TableFooter({
  className = '',
  ...props
}: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      {...props}
      className={`border-t border-line font-semibold ${className}`}
    />
  );
}

export function TableRow({ className = '', ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      {...props}
      className={`border-b border-line last:border-b-0 ${className}`}
    />
  );
}

export function TableHead({ className = '', ...props }: ComponentProps<'th'>) {
  return (
    <th
      {...props}
      className={`px-3 py-2 text-left text-xs font-medium text-muted ${className}`}
    />
  );
}

export function TableCell({ className = '', ...props }: ComponentProps<'td'>) {
  return <td {...props} className={`px-3 py-2 align-middle ${className}`} />;
}
