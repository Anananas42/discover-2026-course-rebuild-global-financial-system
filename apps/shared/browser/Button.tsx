import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

// The one button, for every app and every background: the border derives
// from the text color (currentColor), so it stays visible on the page and
// on the brand band alike without per-context styling. With `href` it
// renders as a link, keeping the same look.

const BUTTON_CLASS =
  'inline-flex cursor-pointer items-center gap-2 rounded-md border border-current/30 px-4 py-1.5 text-sm hover:border-current disabled:cursor-default disabled:opacity-50';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: undefined;
};
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const className = `${BUTTON_CLASS} ${props.className ?? ''}`;
  if (props.href !== undefined) {
    return <a {...props} className={className} />;
  }
  return (
    <button
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
      className={className}
    />
  );
}
