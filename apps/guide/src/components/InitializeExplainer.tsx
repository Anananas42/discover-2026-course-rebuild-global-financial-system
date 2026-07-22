import { ArrowUp } from 'lucide-react';

import { Button } from '@banks/shared/browser/Button.tsx';

// The bridge out of the mission briefing: task 1.1 is the first task
// that happens inside the financial system, so its card explains the
// initialize button the finished briefing reveals in the hero — and
// offers a ride up to it. Same card shell as the concept explainers,
// but its one action is the scroll, so there is no mark-as-read.
export function InitializeExplainer() {
  return (
    <div className="rounded-lg border border-line px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 className="text-[15px] font-semibold">Enter the real world</h4>
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="text-muted hover:text-ink"
        >
          <ArrowUp size={15} aria-hidden /> Take me there
        </Button>
      </div>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        <p>
          The mission briefing ends with a new button at the top of this guide:
          "Initialize your financial system".
        </p>
        <p>
          It asks who you are: your name, the country the United Nations has
          assigned to you, and your currency's ticker and decimal places. From
          then on, the button at the top opens your country's financial system —
          the real world, where this task and everything after it takes place.
        </p>
      </div>
    </div>
  );
}
