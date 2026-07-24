// Scroll-and-flash for the bridge cards' "take me" buttons: brings the
// target element into view and pulses the brand glow on it briefly, so
// the eye lands on the control the card was talking about.

const FLASH = ['ring-4', 'ring-brand-vivid/70', 'rounded-lg'];

let pending: { el: HTMLElement; timer: number } | undefined;

export function flashTarget(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (pending) {
    window.clearTimeout(pending.timer);
    pending.el.classList.remove(...FLASH);
  }
  el.classList.add(...FLASH);
  pending = {
    el,
    timer: window.setTimeout(() => {
      el.classList.remove(...FLASH);
      pending = undefined;
    }, 1600),
  };
}
