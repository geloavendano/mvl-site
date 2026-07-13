# HANDOFF — Metarice Volleyball League (MVL 2026) website

## Project state: Phase 2 landing page DONE (placeholder assets). Phase 1 teaser + dedicated pages NOT started.

## What this is
Immersive site for a volleyball league (MVL 2026, "3rd Annual Invitational", Aug 15–16 & 21–23, Gameville Ball Park + Double Play). Client's peg is https://www.idl.pro/ — maximal, energetic, everything about the competition laid out excitingly. Mobile-first, responsive.

Two audience phases:
- **Phase 1 (teaser, pre–Aug 15)**: players signing up. Wireframe: teaser poster hero w/ dates + venue, then CTAs: waiver, watch 2025 highlights, 2026 rules. IG|TT footer. NOT BUILT YET.
- **Phase 2 (live)**: players in the tournament. BUILT — this repo's `index.html`.

## Stack & files (no build step, static, deliberate choice — do not introduce a framework without asking)
- `index.html` — Phase 2 landing. Five folds: sticky nav / full-bleed hero / sponsor marquee / The Teams / Watch the Games / footer (2nd marquee + bar).
- `schedule.html` — Schedule & standings page. Renders computed standings, day tabs, match cards, set scores, winner labels, pending games, and player-of-game slots.
- `css/style.css` — all styles. Mobile-first, ONE breakpoint at `min-width: 960px`. Design tokens as CSS vars in `:root`.
- `js/league-data.js` — shared static data source for livestream, teams, sponsors, and games. This is the temporary frontend mirror of the future backend.
- `js/main.js` — landing page rendering + IntersectionObservers.
- `js/schedule.js` — computes standings from `league-data.js`, renders tabs and games.
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
2. **Teams fold**: now compressed into IDL-style preview cards so all 8 teams fit in one desktop fold. Cards use hard borders, angled color shards, photo texture on the right, `01 / 08` mono index, and ↗ bordered arrow button. Team data now carries the gradient palette: green, aqua, orange, blue, red, violet, yellow, pink.

## Layout gotchas (bugs already fixed — don't reintroduce)
- `overflow-x: hidden` must live on `html` (body-only propagates to viewport and inflates widths when a classic scrollbar exists).
- `.band` needs `min-width: 0` (grid item min-content was forcing 13px overflow at 375px).
- Team cards should stay compact: desktop is a 4 × 2 grid with `min-height: clamp(174px, calc((100svh - 250px) / 2), 226px)`. Keep the hard border / angled-shard structure when swapping in real player imagery.
- Games drift bg is intentionally rendered at 50% size with `scale(2.24→2.44)` and half-blur (`9px` mobile / `12px` desktop) — perf optimization (~8× cheaper than full-res blur). Keep this pattern if touching it.
- Desktop games modular grid: past games are SPLIT in HTML — `#pastSide` (first 2, right column next to livestream) and `#pastBottom` (last 4, full-width 4-col row). On mobile both render as stacked 2-col grids that read as one grid (negative margin stitches them). `js/main.js` slices `GAMES` accordingly.

## Environment warning (preview pane, not the site)
The in-app Browser pane's screenshot capture FREEZES when the page is scrolled at desktop width (compositor bug; frames go blank navy or stale). Page itself is fine — verified via DOM geometry + real mobile captures. Workarounds: verify desktop layout via JS `getBoundingClientRect`; screenshots at mobile preset work after a fresh `navigate` + instant `scrollIntoView`/`scrollTo` (inject `html{scroll-behavior:auto}` first); avoid the `computer` scroll action on this page (it times out and wedges the tab until you navigate again).

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
1. **Phase 1 teaser page** — same design system; per wireframe: full-bleed teaser-poster hero, dates "Aug 29, 30, 31 / Sep 6, 7" (NOTE: wireframe dates differ from KV's Aug 15–16/21–23 — ask the client which is current), venue, three CTAs (waiver / 2025 highlights / 2026 rules), IG|TT footer. Suggest `teaser.html` or a folder, client to choose how phases swap (likely just deploying one or the other).
2. **Raffle page + backend endpoint** — form asks for team, name, and detected GPS. Server must compute venue-radius eligibility and timestamp the entry; users should not manually adjust the pin.
3. Rules page, team detail pages (team-card ↗ arrows), video pages/modal — all TBD with client.

## Verification
Run the `mvl-site` launch config, check at 375px and ≥960px. Teams: 8 compact cards, all visible in one desktop fold, no horizontal scroll. Nav: logo absent at top, joins on scroll past hero. Reveals fire once per element. Marquees loop seamlessly (list duplicated in JS).
