# HANDOFF — Metarice Volleyball League (MVL 2026) website

## Project state: Phase 2 landing page DONE (placeholder assets). Phase 1 teaser page DONE (placeholder assets). Other dedicated pages (rules, raffle, team detail) NOT started.

## What this is
Immersive site for a volleyball league (MVL 2026, "3rd Annual Invitational", Gameville Ball Park + Double Play). Client's peg is https://www.idl.pro/ — maximal, energetic, everything about the competition laid out excitingly. Mobile-first, responsive.

**⚠️ Unresolved date conflict, needs client sign-off:** Phase 1's real dates are client-confirmed as **Aug 29, 30, 31 & Sep 6, 7** (`teaser.html`). Phase 2 (`index.html`, `schedule.html`, `js/league-data.js`) still uses **Aug 15–16, 21–23** — inherited from the `assets/mvl-kv.png` key visual, never reconciled against the confirmed real dates. Since both phases describe the same event, one of these is wrong. Likely fix: Phase 2's hero kicker text and every `GAMES[].startsAt` in `league-data.js` need updating to the confirmed dates (the schedule already has 5 match days, which lines up with 5 confirmed dates: Aug 29/30/31 + Sep 6/7). Don't change this without asking the client to confirm first — flag it prominently.

Two audience phases:
- **Phase 1 (teaser, pre-event)**: players signing up. `teaser.html` — full-bleed hero (no top nav, per wireframe), dates + venue, three CTAs (waiver / 2025 highlights / 2026 rules), IG|TT footer.
- **Phase 2 (live)**: players in the tournament. `index.html` + `schedule.html`.

## Stack & files (no build step, static, deliberate choice — do not introduce a framework without asking)
- `index.html` — Phase 2 landing. Five folds: sticky nav / full-bleed hero / sponsor marquee / The Teams / Watch the Games / footer (2nd marquee + bar).
- `schedule.html` — Schedule & standings page. Renders computed standings, day tabs, match cards, set scores, winner labels, pending games, and player-of-game slots.
- `teaser.html` — Phase 1 teaser landing. No top nav (nothing to link to pre-event). Hero + 3 CTAs + footer only. Uses `js/teaser.js` (just the reveal observer, no data deps) instead of `main.js`.
- `css/style.css` — all styles for every page (index/schedule/teaser share one file). Mobile-first, ONE breakpoint at `min-width: 960px`. Design tokens as CSS vars in `:root`. Teaser-specific rules live in the `Teaser (Phase 1) page` block at the end of the file.
- `js/league-data.js` — shared static data source for livestream, teams, sponsors, and games. This is the temporary frontend mirror of the future backend. Not used by `teaser.html` (no team/game data needed pre-event).
- `js/main.js` — landing page rendering + IntersectionObservers.
- `js/schedule.js` — computes standings from `league-data.js`, renders tabs and games.
- `js/teaser.js` — reveal-on-scroll only, no data arrays.
- `backend/schema.sql` — Supabase/Postgres schema draft for teams, players, venues, games, sets, videos, sponsors, and raffle check-ins.
- `backend/README.md` — backend setup recommendation and data-flow notes.
- `assets/team-stock.png` — temporary local stock/comp image used inside the Teams cards to preview the eventual player-photo/cutout treatment.
- `assets/mvl-kv.png` — 2026 key visual poster (portrait 1024×1280). Used as hero bg, and blurred drifting bg in games fold.
- `.claude/launch.json` — dev server: `python3 -m http.server 8742` (name `mvl-site`).
- Design handoff source (Claude Design bundle w/ README spec + prototype) extracted at scratchpad `mvl-mock/design_handoff_mvl_phase2_landing/` — session-specific path; the client can re-share the zip (`~/Downloads/Metarice Volleyball League website.zip`) if needed.

## Design tokens
- Navy page bg `#16104A`, deep strip `#0B0730`, footer `#080522`
- Mint `#7CF5B4` (primary accent), Teal `#2DD4BF` (secondary), Indigo `#4338CA` (separators), Live red `#E11D48`
- Team band cycle: `#5B4FE8 → #0FB5A6 → #7C3AED → #2563EB` (index % 4)
- Fonts (Google): **Anton** display, always uppercase, italic for hype headings; **Archivo** 700–900 UI labels w/ wide letter-spacing; ui-monospace for tiny meta.
- Motion: reveals 500ms ease-out stagger ~70ms; marquee 22s/26s linear; drift 26s alternate; pulse 1.4s. All gated by `prefers-reduced-motion`.

## Client feedback already incorporated (do not regress)
1. **Nav**: client disliked the mock's image-slice nav bg → now a clean glass bar: transparent at top, `nav--stuck` (dark + backdrop blur + mint hairline) past the hero. **Logo-join is the signature interaction**: nav has no logo while hero is in view; IntersectionObserver on `#hero` (rootMargin -64px) toggles `nav--stuck`, and `.nav-logo` animates in (translateY+scale → none, 300ms). Hero holds the big "MVL 2026" (Anton italic).
2. **Teams fold**: now compressed into IDL-style preview cards so all 8 teams fit in one desktop fold. Cards use hard borders, angled color shards, photo texture on the right, `01 / 08` mono index, and ↗ bordered arrow button.
3. **Roster (client-confirmed, `js/league-data.js`)**: Metarice X (violet), Metarice Y (green), Thurstrap (aqua), Gizmo (pink), Gremlins (red), SSVC (yellow), S24 (blue), UP Leftout (orange). `GAMES` team references were remapped 1:1 by original array position — matchup shape (day/court/scores) is unchanged from the sample data, only identities.

## Layout gotchas (bugs already fixed — don't reintroduce)
- `overflow-x: hidden` must live on `html` (body-only propagates to viewport and inflates widths when a classic scrollbar exists).
- `.band` needs `min-width: 0` (grid item min-content was forcing 13px overflow at 375px).
- Team cards should stay compact: desktop is a 4 × 2 grid with `min-height: clamp(166px, calc((100svh - 260px) / 2), 204px)`. Keep the hard border / angled-shard structure when swapping in real player imagery.
- `.team-card-copy` padding-bottom (mobile 58px, desktop 62px) is deliberately large — it clears the absolutely-positioned `.team-card-link` arrow button, which sits bottom-left at the same anchor as the division tag. Shrinking that padding puts the tag text underneath the button again (was a real bug, fixed once already).
- Games drift bg is intentionally rendered at 50% size with `scale(2.24→2.44)` and half-blur (`9px` mobile / `12px` desktop) — perf optimization (~8× cheaper than full-res blur). Keep this pattern if touching it.
- Desktop games modular grid: past games are SPLIT in HTML — `#pastSide` (first 2, right column next to livestream) and `#pastBottom` (last 4, full-width 4-col row). On mobile both render as stacked 2-col grids that read as one grid (negative margin stitches them). `js/main.js` slices `GAMES` accordingly.

## Environment warnings (preview pane, not the site)
- The in-app Browser pane's screenshot capture FREEZES when the page is scrolled at desktop width (compositor bug; frames go blank navy or stale). Page itself is fine — verified via DOM geometry + real mobile captures. Workarounds: verify desktop layout via JS `getBoundingClientRect`; screenshots at mobile preset work after a fresh `navigate` + instant `scrollIntoView`/`scrollTo` (inject `html{scroll-behavior:auto}` first); avoid the `computer` scroll action on this page (it times out and wedges the tab until you navigate again).
- The Browser pane's `<link>` stylesheet caches aggressively — editing `style.css` and reloading (even with `location.reload(true)` or a `?cachebust=` query on the *page* URL) can serve stale CSS while a raw `fetch(..., {cache:'no-store'})` of the same file shows the edit is actually on disk. If computed styles don't reflect a CSS edit, bump the stylesheet's own query string directly: `document.querySelector('link[href*="style.css"]').href = 'css/style.css?v=' + Date.now()`. Confirmed twice now (once on `.team-card-copy`, once on `.teaser-hero`) — check this before assuming an edit didn't take or a selector is wrong.

## Placeholders awaiting real assets (striped blocks = placeholder convention)
1. Hero: portrait KV crops at desktop — client intends a landscape photo or muted autoplay video (`object-fit: cover`).
2. Real team/captain imagery ×8 — replace the temporary `assets/team-stock.png` treatment with team-specific player photos or transparent cutouts inside `.team-card-photo`.
3. Roster figures ×7/team — optional if the team cards expand into detail pages or a larger team section.
4. Livestream: swap `.live-frame` for a YouTube iframe (client confirmed YouTube). `isLive` flag at top of `main.js` gates the pulsing red dots (currently `true`; ideally wire to YouTube API later).
5. Past-game thumbnails ×6 + video links (matchups/durations in `GAMES` are sample data).
6. Sponsor logos ×8 (currently text marquee — keep the marquee when swapping).
7. All `data-todo` hrefs: raffle link, schedule page, rules page, IG/TT URLs, video links.
8. Real MVL logo mark to replace the Anton-italic "MVL" text in nav/hero/footer.

## Next tasks (client priority order)
1. **Resolve the Phase 1/2 date conflict** (see top of doc) before going further — it affects hero copy and schedule data on the live site.
2. **Raffle page + backend endpoint** — form asks for team, name, and detected GPS. Server must compute venue-radius eligibility and timestamp the entry; users should not manually adjust the pin.
3. Rules page, team detail pages (team-card ↗ arrows), video pages/modal, dedicated teaser poster asset (currently reusing `mvl-kv.png` with a heavy scrim to bury its baked-in Phase-2 dates — see teaser hero note above) — all TBD with client.
4. Decide how the two phases swap in production (single domain redirect, manual deploy swap, etc.) — not yet decided.

## Verification
Run the `mvl-site` launch config.
- **index.html / schedule.html**: check at 375px and ≥960px. Teams: 8 compact cards, all visible in one desktop fold, no horizontal scroll, names distinct (no more duplicate "Metarice"). Nav: logo absent at top, joins on scroll past hero. Reveals fire once per element. Marquees loop seamlessly.
- **teaser.html**: hero fills full viewport height (100svh) with centered dates/venue over a heavily-scrimmed KV background; 3 CTAs stack on mobile, row on desktop; no top nav present (intentional, matches wireframe).
