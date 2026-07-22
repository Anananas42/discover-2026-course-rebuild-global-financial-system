import { ExternalLink } from 'lucide-react';

import weNeedYou from '../assets/we-need-you.png';
import { ZoomableImage } from './ZoomableImage.tsx';

export function ProjectIntro({
  financialSystemUrl,
}: {
  financialSystemUrl: string;
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
      {/* Not the shared Button: its text-sm would win the Tailwind
          conflict against any size override. The hero CTA is its own
          element. */}
      <div className="my-7 flex justify-center">
        <a
          href={financialSystemUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2.5 rounded-xl bg-accent-fill px-8 py-3 text-xl font-semibold text-accent-ink shadow-lg hover:brightness-110"
        >
          Financial system
          <ExternalLink size={22} aria-hidden />
        </a>
      </div>
    </section>
  );
}
