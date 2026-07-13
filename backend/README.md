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
supabase db query --linked --file supabase/migrations/20260713000200_drop_public_mvl_prefixed_tables.sql
```

## Schema

MVL lives in its own Postgres schema, separate from Sansayaw's existing public tables:

- `mvl.venues`
- `mvl.teams`
- `mvl.players`
- `mvl.games`
- `mvl.game_sets`
- `mvl.game_videos`
- `mvl.sponsors`
- `mvl.raffle_checkins`
- `mvl.waiver_submissions`

The initial `public.mvl_*` tables were removed after the schema migration.

## Current Live Integration

`waiver.html` submits through this public RPC:

```text
public.mvl_submit_waiver(...)
```

The RPC writes into `mvl.waiver_submissions`.

using the public anon key in:

```text
js/supabase-config.js
```

The anon key is safe to ship in browser code; access is controlled by row-level security.

## Score Entry

Use this playbook for admin score entry in Supabase SQL Editor:

```text
supabase/admin-score-entry.sql
```

The main helper is:

```sql
public.mvl_record_game_result(...)
```

It updates the game winner/status, replaces set scores, assigns Player of the Game, and upserts a YouTube recording link in one transaction.

## RLS

Current policies:

- Public can read league content tables.
- Public can insert waiver submissions only when `waiver_acknowledged = true`.
- Raffle check-ins are intended to go through the `mvl_create_raffle_checkin(...)` RPC so the server computes venue radius eligibility.

## Raffle GPS Rule

Use browser geolocation only to collect the user's detected position. Do not allow manual pin editing in the UI. The server records timestamp and computes `inside_radius`. Device GPS can still be spoofed at the OS/browser level, so describe this as device-location validation rather than fraud-proof physical presence.
