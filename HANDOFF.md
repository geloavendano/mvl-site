# HANDOFF — Metarice Volleyball League (MVL 2026) website

## Project state: Phase 2 landing DONE. Phase 1 teaser DONE. Rules page DONE. Waiver page DONE and connected to Supabase. Raffle check-in page BUILT (pending one migration on live DB — see Raffle section). Remaining: team detail pages.

## Raffle check-in (`raffle.html` + `js/raffle.js`)
Game-day raffle per client decisions (2026-07-17): one successful entry per person per game day; identity = name + team only (winners claim on-site); open on game days only (derived from `games` data, Manila time); outside-venue attempts are recorded as ineligible, not rejected.
- Flow: game-day gate → team + full name → one-time `getCurrentPosition` (no manual pin, per backend/README.md) → `mvl_create_raffle_checkin` RPC → server decides `inside_radius` vs the venue's 150m radius. Result states: confirmed / already-entered / outside-with-distance+retry / geolocation errors. `?preview=1` unlocks the form UI on non-game days for testing (server still refuses).
- Venue UUID hardcoded in raffle.js: `11111111-1111-4111-8111-111111111111`.
- **⚠️ BLOCKER until applied:** `supabase/migrations/20260717000100_raffle_checkin_rules.sql` must be run against the linked project (`supabase db query --linked --file …`, NOT `db push`). It sets Gameville's real coordinates (14.575241, 121.0543052 — venues were seeded with NULL locations, so every check-in fails without this), deletes the duplicate venue row, adds the one-entry-per-day partial unique index, and updates the RPC (adds `already_entered` to the return row + game-day gate). Get client go-ahead before applying — it's their production DB.

## What this is
Immersive site for a volleyball league (MVL 2026, "3rd Annual Invitational", Gameville Ball Park + Double Play). Client's peg is https://www.idl.pro/ — maximal, energetic, everything about the competition laid out excitingly. Mobile-first, responsive.

**Confirmed event dates:** August 29, 30, 31, September 5, and September 6, 2026.

Two audience phases:
- **Phase 1 (teaser, pre-event)**: players signing up. `teaser.html` — single-fold full-bleed video hero (no top nav, per wireframe): MVL logo image, dates, venue link (Google Maps: https://maps.app.goo.gl/sK1HuKBVwRSZPpHz9), "Save the Dates" pill (downloads `assets/mvl-2026-dates.ics` — 2 all-day span VEVENTs for Aug 29–31 and Sep 5–6, works across Apple/Google/Outlook; client chose ICS over per-service buttons), and all three CTAs (waiver / 2025 highlights / 2026 rules) within the first viewport at both breakpoints. IG|TT footer.
- **Phase 2 (live)**: players in the tournament. `index.html` + `schedule.html`.

## Stack & files (no build step, static, deliberate choice — do not introduce a framework without asking)
- `index.html` — Phase 2 landing. Five folds: sticky nav / full-bleed hero / sponsor marquee / The Teams / Watch the Games / footer (2nd marquee + bar).
- `schedule.html` — Schedule & standings page. Renders computed standings, day tabs, match cards, set scores, winner labels, pending games, and player-of-game slots.
- `teaser.html` — Phase 1 teaser landing. No top nav (nothing to link to pre-event). Hero + 3 CTAs + footer only. Uses `js/teaser.js` (just the reveal observer, no data deps) instead of `main.js`.
- `css/style.css` — all styles for every page (index/schedule/teaser share one file). Mobile-first, ONE breakpoint at `min-width: 960px`. Design tokens as CSS vars in `:root`. Teaser-specific rules live in the `Teaser (Phase 1) page` block at the end of the file.
- `js/league-data.js` — shared static data source for livestream, teams, sponsors, and games. Still used for front-end rendering; the same starter data has been seeded into Supabase.
- `js/main.js` — landing page rendering + IntersectionObservers.
- `js/schedule.js` — computes standings from `league-data.js`, renders tabs and games. Ranking order is wins, set ratio, points ratio, head-to-head wins, head-to-head set ratio, head-to-head points ratio, then team name.
- `js/teaser.js` — reveal-on-scroll + the Save-the-Dates `<dialog>` action sheet (device-calendar .ics / Google Calendar Weekend 1 / Weekend 2; trigger href falls back to the .ics without JS). The 2025-highlights CTA is a plain link to the Instagram reel — an embedded lightbox was built and then REMOVED at client request (IG embeds don't play natively in-page), don't rebuild it.
- `rules.html` — static rules page: FAQ accordion ("The Quick Version") at top, then the full 10-section rulebook (client-provided text) with tables for the bracket, schedule, and scoring. No JS. NOTE: the client's source text said "Battle for Gold: **Loser** of SF1 vs Loser of SF2" — an obvious copy-paste typo, rendered as Winner vs Winner.
- `waiver.html` — participant registration + waiver form. Uses `js/league-data.js` to populate teams and `js/waiver.js` for client validation / relationship "Other" behavior. Submit calls Supabase RPC `public.mvl_submit_waiver(...)`, which writes to `mvl.waiver_submissions`.
- `js/supabase-config.js` — public Supabase URL + anon key for the existing `sansayaw` project. The anon key is intentionally public; RLS protects writes.
- **Footers (all pages)**: MVL logo image + Instagram/TikTok/YouTube icon links (instagram.com/metaricevolley, tiktok.com/@metaricevolley, youtube.com/@metaricevolley). Icon SVGs are duplicated inline per page — keep them in sync.
- `supabase/migrations/20260713000100_create_mvl_schema.sql` — applied to existing Supabase project `sansayaw` (`ljebzcgfydaknyekwlqv`) via `supabase db query --linked --file ...`. Creates dedicated Postgres schema `mvl` with tables like `mvl.teams`, `mvl.games`, and `mvl.waiver_submissions`.
- `supabase/seed.sql` — applied to the linked Supabase project; seeds venues, current teams, placeholder games, and set scores.
- `supabase/migrations/20260713000200_drop_public_mvl_prefixed_tables.sql` — applied after the schema migration to remove the initial `public.mvl_*` tables.
- `supabase/migrations/20260713000300_add_mvl_standings.sql` — adds `public.mvl_get_standings()`, which mirrors the frontend standings ranking from `mvl.games` and `mvl.game_sets`.
- `supabase/migrations/20260714000100_update_mvl_event_dates.sql` — applied to align seeded Supabase game dates to Aug 29, Aug 30, Aug 31, Sep 5, and Sep 6.
- `backend/schema.sql` — older unprefixed draft; historical reference only.
- `backend/README.md` — actual Supabase setup notes for the existing `sansayaw` project.
- `assets/team-stock.png` — temporary local stock/comp image used inside the Teams cards to preview the eventual player-photo/cutout treatment.
- `assets/mvl-video-1-web-10s.mp4` — optimized 10s teaser hero background video. The larger source video files are ignored by git.
- `assets/mvl-kv.png` — 2026 key visual poster (portrait 1024×1280). Used as video poster/fallback for teaser, Phase 2 hero bg, and blurred drifting bg in games fold.
- `assets/mvl-logo.png` — **2025** logo (client-provided placeholder, downscaled to 800px from a 4500px source in `~/Downloads/MVL 2025 Logo.png`). Used in the teaser hero. Swap for the 2026 mark when it exists — it will still say 2025 until then.
- `assets/mvl-2026-dates.ics` — hand-built calendar file for the teaser's Save the Dates button (2 all-day span events: Aug 29–31 and Sep 5–6, literal `\n` escapes in DESCRIPTION — regenerate carefully if dates change).
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
1. Phase 2 hero: portrait KV crops at desktop — client intends a landscape photo or muted autoplay video (`object-fit: cover`).
2. Real team/captain imagery ×8 — replace the temporary `assets/team-stock.png` treatment with team-specific player photos or transparent cutouts inside `.team-card-photo`.
3. Roster figures ×7/team — optional if the team cards expand into detail pages or a larger team section.
4. Livestream: swap `.live-frame` for a YouTube iframe (client confirmed YouTube). `isLive` flag at top of `main.js` gates the pulsing red dots (currently `true`; ideally wire to YouTube API later).
5. Past-game thumbnails ×6 + video links (matchups/durations in `GAMES` are sample data).
6. Sponsor logos ×8 (currently text marquee — keep the marquee when swapping).
7. All `data-todo` hrefs: raffle link, schedule page, rules page, IG/TT URLs, video links.
8. Real MVL logo mark to replace the Anton-italic "MVL" text in nav/hero/footer.

## Next tasks (client priority order)
1. **Raffle page + backend endpoint** — form asks for team, name, and detected GPS. Server must compute venue-radius eligibility and timestamp the entry; users should not manually adjust the pin.
2. Rules page, team detail pages (team-card ↗ arrows), video pages/modal — all TBD with client.
3. Decide how the two phases swap in production (single domain redirect, manual deploy swap, etc.) — not yet decided.

## Verification
Run the `mvl-site` launch config.
- **index.html / schedule.html**: check at 375px and ≥960px. Teams: 8 compact cards, all visible in one desktop fold, no horizontal scroll, names distinct (no more duplicate "Metarice"). Nav: logo absent at top, joins on scroll past hero. Reveals fire once per element. Marquees loop seamlessly.
- **teaser.html**: hero fills full viewport height (100svh) with centered dates/venue over autoplay muted video; 3 CTAs stack on mobile, row on desktop; no top nav present (intentional, matches wireframe).
