/* ==========================================================================
   Shared nav behaviour.
   Every page carries the same nav markup; this decides which links apply to
   the current phase and marks the current page.
   ========================================================================== */

// Stamped synchronously (this file loads in <head>) so CSS hides the
// wrong-phase links before first paint — no flash, no layout shift.
document.documentElement.dataset.phase = window.MVL_SITE?.phase || 'registration';

document.addEventListener('DOMContentLoaded', () => {
  // '/mvl/schedule.html' and '/mvl/schedule' both normalise to '/mvl/schedule';
  // a directory URL normalises to its index.
  const normalise = (path) => path.replace(/\.html$/, '').replace(/\/$/, '/index');
  const here = normalise(location.pathname);

  document.querySelectorAll('.nav-links a').forEach((link) => {
    // .pathname resolves the relative href against the current URL for free
    if (normalise(link.pathname) !== here) return;
    link.setAttribute('aria-current', 'page');
    // Always show the page you're actually on, even if its phase is hidden —
    // otherwise the nav omits the page under your feet.
    link.dataset.phase = '';
  });
});
