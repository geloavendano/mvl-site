// Which phase the MVL site is in. Drives which links the shared nav shows.
//
//   'registration' — before the tournament (nav: Rules, Waiver)
//   'gameday'      — from Aug 29 2026 onward (nav: Schedule, Videos, Teams,
//                    Rules, Registration)
//
// Flipping this is one of the two game-day edits — see HANDOFF.md.
window.MVL_SITE = { phase: 'registration' };
