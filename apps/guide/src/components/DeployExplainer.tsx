import { ArrowUp } from 'lucide-react';

import { Button } from '@banks/shared/browser/Button.tsx';

import { flashTarget } from '../flash-target.ts';

// The second half of the bridge out of the mission briefing: the card
// above announces the initialize button, this one the deploying that
// follows the task. Same card shell; its one action is the ride to the
// toolbar slot, so there is no mark-as-read. Leaves with its sibling on
// initialize.
export function DeployExplainer() {
  return (
    <div className="rounded-lg border border-line px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h4 className="text-[15px] font-semibold">Deploy system updates</h4>
        <Button
          onClick={() => flashTarget('deploy-target')}
          className="text-muted hover:text-ink"
        >
          <ArrowUp size={15} aria-hidden /> Take me to deployment
        </Button>
      </div>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        <p>
          Once you finish this task, press "Deploy updates" — it sits next to
          "Run tests" from the moment your financial system exists.
        </p>
        <p>
          The course server checks your work with stricter tests than the local
          ones and shows the result on the classroom board.
        </p>
      </div>
    </div>
  );
}
