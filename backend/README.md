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
supabase db query --linked --file supabase/migrations/20260713000300_add_mvl_standings.sql
supabase db query --linked --file supabase/migrations/20260714000100_update_mvl_event_dates.sql
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

`waiver.html` loads the selected team's roster through:

```text
public.mvl_get_team_players(...)
```

It then submits the selected roster player through:

```text
public.mvl_submit_player_waiver(...)
```

The submission RPC verifies that the player belongs to the selected team, then
writes the player reference and contact details into `mvl.waiver_submissions`.
It also updates the player's `contact_number`, `email`, and `instagram_handle`
columns, so a later waiver submission replaces those current profile values
while preserving every waiver submission as history.
The older `public.mvl_submit_waiver(...)` helper remains available for
backward compatibility.

using the public anon key in:

```text
js/supabase-config.js
```

The anon key is safe to ship in browser code; access is controlled by row-level security.

## Admin Google OAuth

MVL and Bonado share the Supabase Auth project. Keep Bonado's Auth `Site URL`
unchanged, and keep these exact MVL URLs in Auth's additional redirect allowlist:

```text
https://www.metaricevolley.ph/mvl/admin
https://metaricevolley.ph/mvl/admin
```

The admin client sends the current origin plus `/mvl/admin` as its OAuth
`redirectTo`. The shorter `/admin` aliases are not sufficient: when the exact
callback is absent, Supabase discards it and falls back to the shared project's
Bonado Site URL.

## Waiver Confirmation Email

After `public.mvl_submit_player_waiver(...)` returns the new waiver submission
id, the browser calls this Supabase Edge Function:

```text
send-waiver-confirmation
```

The function calls `public.mvl_get_waiver_confirmation_email_payload(...)`
with the service role key, then sends the player a confirmation email through
Resend. That RPC returns only the fields needed for the email and is not
granted to anon or authenticated users. The email includes:

- MVL registration confirmation and team name
- Google Calendar links for both MVL weekends
- `MVL-2026-Save-the-Dates.ics` as an Apple/Outlook/device calendar attachment
- Instagram and website announcement links in the email and calendar metadata
- the full Data Privacy, consent, waiver, and release text agreed to on submit
- an automated-email / no-reply note

Set these function secrets before relying on email delivery:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set MVL_EMAIL_FROM="MVL 2026 <mingu@metaricevolley.ph>"
supabase secrets set MVL_SITE_URL="https://metaricevolley.ph"
```

Apply the RPC migration with:

```bash
supabase db query --linked --file supabase/migrations/20260802000200_waiver_confirmation_email_payload.sql
```

Deploy the function with:

```bash
supabase functions deploy send-waiver-confirmation
```

`mingu@metaricevolley.ph` must be configured on a verified Resend domain
before Resend will send from it in production.

## Score Entry

Use this playbook for admin score entry in Supabase SQL Editor:

```text
supabase/admin-score-entry.sql
```

The admin dashboard saves results through:

```text
public.mvl_admin_save_game_result(
  p_game_id,
  p_winner_team_id,
  p_player_of_game_id,
  p_sets,
  p_videos
)
```

It updates the game winner/status, replaces set scores, assigns Player of the
Game, and replaces that game's ordered video list in one transaction. Each
video item contains a custom label and parsed YouTube ID:

```json
[
  { "label": "Set 1", "youtube_id": "Q17jVubwlO8" },
  { "label": "Full Game", "youtube_id": "vURQKclE9PI" }
]
```

The older `public.mvl_record_game_result(...)` helper remains available for
backward compatibility with single-video scripts.

## Admin Access

Admin access uses a normalized email allowlist and Google SSO. An administrator
can be registered before their first sign-in:

```sql
insert into mvl.admin_users (email)
values (lower(trim('admin@example.com')))
on conflict (email) do nothing;
```

The email must be the exact email returned by the person's Google account.
Removing the allowlist row revokes admin access without deleting their Supabase
Auth account:

```sql
delete from mvl.admin_users
where email = lower(trim('admin@example.com'));
```

## Player of the Game roster

Player portraits live in the public `mvl-player-photos` Storage bucket. Use an
object path based on the team and admin lookup key:

```text
metarice-x/santos-04.webp
```

Create the matching roster row in `mvl.players`:

```sql
insert into mvl.players (
  team_id,
  display_name,
  surname,
  jersey_number,
  role,
  photo_path
) values (
  'metarice-x',
  'Juan Santos',
  'Santos',
  '04',
  'Outside Hitter',
  'metarice-x/santos-04.webp'
);
```

In the admin dashboard, select the winning team and enter `santos-04`. The
lookup is scoped to that winning team's roster. A database trigger also prevents
a Player of the Game from being assigned to a player on the losing team.

## Standings Ranking

The standings helper is:

```sql
public.mvl_get_standings()
```

It ranks teams from completed games using this order:

1. Wins
2. Set ratio
3. Points ratio
4. Head-to-head wins among still-tied teams
5. Head-to-head set ratio
6. Head-to-head points ratio
7. Team name

The current static `schedule.html` renderer mirrors this logic from `js/league-data.js` until the page is wired directly to Supabase.

## RLS

Current policies:

- Public can read league content tables.
- Public can insert waiver submissions only when `waiver_acknowledged = true`.
- Raffle check-ins are intended to go through the `mvl_create_raffle_checkin(...)` RPC so the server computes venue radius eligibility.

## Raffle GPS Rule

Use browser geolocation only to collect the user's detected position. Do not allow manual pin editing in the UI. The server records timestamp and computes `inside_radius`. Device GPS can still be spoofed at the OS/browser level, so describe this as device-location validation rather than fraud-proof physical presence.
