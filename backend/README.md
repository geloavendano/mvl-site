# MVL Backend Blueprint

Recommended setup for the next phase:

- **GitHub** for source control and deployment history.
- **Supabase** for Postgres, auth/admin access, raffle submissions, standings data, team rosters, videos, and storage metadata.
- **Vercel or Netlify** for hosting the static site first. Either can point to the purchased domain later.

Why Supabase fits this project:

- Standings, schedules, teams, videos, sponsor billing, and raffle entries are relational data.
- Postgres can compute standings from official game/set rows.
- PostGIS can validate whether a raffle GPS point is inside a venue radius on the server.
- Row-level security can keep public reads open while restricting score/admin writes.

## Data Flow

1. Admin creates teams, players, venues, sponsors, and scheduled games.
2. Admin records set scores and the game winner after each match.
3. Videos are attached to games by YouTube ID and published timestamp.
4. Team pages query their own players, games, and videos through the shared team IDs.
5. Raffle form sends detected browser geolocation to a server endpoint.
6. Server writes timestamp and computes `inside_radius`; the client never decides eligibility.

## Raffle GPS Rule

Use browser geolocation only to collect the user's detected position. Do not allow manual pin editing in the UI. The form should submit:

- `team_id`
- `name`
- detected latitude/longitude
- browser accuracy in meters
- selected/nearest venue

The server should record `created_at` and compute whether the point is inside the venue radius. Users can spoof device GPS at the OS/browser level, so the system should be described as device-location validation rather than fraud-proof physical presence.

## Suggested Build Order

1. Put this repo on GitHub.
2. Create Supabase project and run `backend/schema.sql`.
3. Replace `js/league-data.js` with reads from Supabase or a generated JSON export.
4. Build `raffle.html` plus a Supabase Edge Function for check-in submission.
5. Build team detail pages using `team_id`.
6. Add sponsor logo assets and billing tiers.
