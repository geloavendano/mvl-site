# MVL Supabase Setup

MVL uses the existing Supabase project:

- Project name: `sansayaw`
- Project ref: `ljebzcgfydaknyekwlqv`
- Public URL: `https://ljebzcgfydaknyekwlqv.supabase.co`

The repo is linked with:

```bash
supabase link --project-ref ljebzcgfydaknyekwlqv
```

## Existing Project Warning

`sansayaw` already has its own remote migration history (`0001` through `0034` at setup time). Because this repo does not own those older migrations, do **not** use `supabase db push` from this repo unless the migration histories are intentionally reconciled.

For MVL changes, apply SQL directly to the linked project:

```bash
supabase db query --linked --file supabase/migrations/20260713000100_create_mvl_schema.sql
supabase db query --linked --file supabase/seed.sql
```

## Table Naming

All MVL tables are prefixed with `mvl_` so they can safely coexist with other Sansayaw tables:

- `mvl_venues`
- `mvl_teams`
- `mvl_players`
- `mvl_games`
- `mvl_game_sets`
- `mvl_game_videos`
- `mvl_sponsors`
- `mvl_raffle_checkins`
- `mvl_waiver_submissions`

## Current Live Integration

`waiver.html` submits directly to:

```text
public.mvl_waiver_submissions
```

using the public anon key in:

```text
js/supabase-config.js
```

The anon key is safe to ship in browser code; access is controlled by row-level security.

## RLS

Current policies:

- Public can read league content tables.
- Public can insert waiver submissions only when `waiver_acknowledged = true`.
- Raffle check-ins are intended to go through the `mvl_create_raffle_checkin(...)` RPC so the server computes venue radius eligibility.

## Raffle GPS Rule

Use browser geolocation only to collect the user's detected position. Do not allow manual pin editing in the UI. The server records timestamp and computes `inside_radius`. Device GPS can still be spoofed at the OS/browser level, so describe this as device-location validation rather than fraud-proof physical presence.
