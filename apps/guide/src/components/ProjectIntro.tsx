import { ArrowDown, ExternalLink } from 'lucide-react';

import type { CourseConfig } from '../../../shared/course-config.ts';
import type { GuideTask } from '../../guide-contract.ts';
import weNeedYou from '../assets/we-need-you.png';
import { courseConfigured, IdentityDialog } from './IdentityDialog.tsx';
import { ZoomableImage } from './ZoomableImage.tsx';

// The hero CTA's shape, shared by all of its lives. The next-task button
// is always outlined — during the mission briefing it stands alone (the
// financial system is not the destination yet), afterwards it accompanies the
// vivid primary: the initialize button in the saturated brand yellow
// plus the glow that marks the next step everywhere in the guide, then —
// once configured — the financial system link in the saturated accent
// pink with a plain lift.
// Not the shared Button: its text-sm would win the Tailwind conflict
// against any size override.
const CTA_CLASS =
  'inline-flex cursor-pointer items-center gap-2.5 rounded-xl px-8 py-3 text-xl font-semibold hover:brightness-110';

export function ProjectIntro({
  financialSystemUrl,
  course,
  briefingDone,
  nextTask,
  onNextTask,
  onSaved,
}: {
  financialSystemUrl: string;
  course: CourseConfig;
  /** Every mission-briefing task passing — the financial system CTA's cue. */
  briefingDone: boolean;
  /** The next task to work on, or null when everything passes. */
  nextTask: GuideTask | null;
  onNextTask: () => void;
  onSaved: () => void;
}) {
  return (
    // The dashboard matrix card's glass, over this page's sky. The hero
    // forces the dark scheme for the scene, but the panel itself follows
    // the app theme: white glass with dark ink in light mode, dark glass
    // in dark mode. text-ink is re-declared here (not inherited from the
    // hero) so it re-resolves under the panel's own color-scheme.
    <section className="rounded-2xl border border-ink/10 bg-page/60 px-6 py-2 text-ink shadow-[inset_0_1px_0] shadow-ink/15 backdrop-blur-xl [[data-theme=light]_&]:bg-page/75 [[data-theme=light]_&]:[color-scheme:light]">
      <div className="my-6 flex flex-wrap items-center justify-center gap-4">
        <ZoomableImage
          src={weNeedYou}
          alt="A recruitment poster: We need you to help rebuild critical financial systems"
          className="h-120 rounded-xl"
        />
      </div>
      {/* The brief reads as the poster's caption: a large centered lede
          carrying the fiction, a calmer second line carrying the how. On
          the dark glass the sun bleeds through, so the text goes full
          white with a shadow to hold contrast; on the light panel the
          ink token already carries it. */}
      <p className="mx-auto my-6 max-w-4xl text-center text-xl/relaxed font-medium [[data-theme=dark]_&]:text-white [[data-theme=dark]_&]:text-shadow-md">
        An electromagnetic storm has wiped out the world's financial systems.
        <br />
        Every balance, every debt, every payment — gone. Money itself is gone.
        <br />
        Your country is waiting, and you are the one bringing it back.
      </p>
      <p className="mx-auto my-5 max-w-4xl text-center text-lg/relaxed text-balance [[data-theme=dark]_&]:text-white [[data-theme=dark]_&]:text-shadow-md">
        Work through the stages below. Every task brings a piece of your
        financial system back online. Around you, the rest of the group is doing
        the same: the world comes back one country at a time.
      </p>
      <div className="my-7 flex flex-wrap items-center justify-center gap-4">
        {briefingDone &&
          (courseConfigured(course) ? (
            <a
              href={financialSystemUrl}
              target="_blank"
              rel="noreferrer"
              className={`${CTA_CLASS} bg-accent-vivid text-accent-vivid-ink shadow-lg`}
            >
              Financial system
              <ExternalLink size={22} aria-hidden />
            </a>
          ) : (
            <IdentityDialog
              course={course}
              onSaved={onSaved}
              trigger={open => (
                <button
                  className={`${CTA_CLASS} bg-brand-vivid text-brand-vivid-ink shadow-[0_0_10px] shadow-brand-vivid/60`}
                  onClick={open}
                >
                  Initialize your financial system
                </button>
              )}
            />
          ))}
        {nextTask !== null && (
          <button
            onClick={onNextTask}
            className={`${CTA_CLASS} border border-ink/30 hover:bg-ink/10`}
          >
            Task {nextTask.id}: {nextTask.title}
            <ArrowDown size={22} aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
