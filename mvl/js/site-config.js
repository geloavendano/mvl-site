// Which phase the MVL site is in. Drives which links the shared nav shows.
//
//   'registration' — before the tournament (nav: Rules, Waiver)
//   'gameday'      — from Aug 29 2026 onward (nav: Schedule, Videos, Teams,
//                    Rules, Registration)
//
// Flipping this is one of the two game-day edits — see HANDOFF.md.
//
// Add the GA4 Measurement ID once the Google Analytics web stream is ready.
// Example: gaMeasurementId: 'G-XXXXXXXXXX'
window.MVL_SITE = {
  phase: 'registration',
  gaMeasurementId: 'G-4150LLQDCJ',
};
