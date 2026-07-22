import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

// Copies the compact IBAN — the canonical paste-anywhere form; the send
// form accepts spaced input anyway. The brief check mark is the only
// feedback a copy needs.

export function CopyIbanButton({ iban }: { iban: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="cursor-pointer align-middle text-muted hover:text-ink"
      title="Copy IBAN"
      aria-label="Copy IBAN"
      onClick={event => {
        // Copying must never trigger the row the button sits in.
        event.stopPropagation();
        void navigator.clipboard.writeText(iban).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
    </button>
  );
}
