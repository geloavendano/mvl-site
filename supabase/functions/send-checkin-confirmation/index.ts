// Game-day raffle check-in confirmation.
//
// Deliberately built on send-waiver-confirmation: same palette, same key-art
// block, same forced-dark-theme locks, same Mingu sign-off. The two mails
// arrive weeks apart from the same sender and should read as one voice.
//
// What differs is the job. The waiver mail is a receipt you keep; this one is
// read at the venue, on a phone, minutes before a player takes the court — so
// it is a game-day hype note first. The day's fixtures are the hero, the
// check-in is a line inside that panel, and the raffle rides along in a single
// chip. Checking in is about playing in the league; the draw is the bonus.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const venue = 'Gameville Ball Park';
const siteUrl = Deno.env.get('MVL_SITE_URL') ?? 'https://metaricevolley.ph';
const mvlUrl = `${siteUrl}/mvl`;
const instagramUrl = 'https://instagram.com/metaricevolley';
const defaultFrom = 'MVL 2026 <mingu@metaricevolley.ph>';

// Palette lifted from css/style.css :root so the email reads as the same
// system as the site. Muted inks are pre-flattened against the card fill —
// email clients have no reliable alpha compositing.
const c = {
  page: '#0B0730',    // --navy-deep
  card: '#16104A',    // --navy
  tonal: '#221C52',   // --surface-tonal over --navy
  footer: '#080522',  // --navy-footer
  hairline: '#2E2963',
  mint: '#7CF5B4',    // --mint
  teal: '#2DD4BF',    // --teal
  ink: '#EDEBFF',     // --ink-soft
  // Both inks stay light enough to survive a forced dark theme: the page they
  // sit on inverts to near-white, and a mid-tone grey goes muddy either way.
  inkMuted: '#C3C0D8',
  inkFaint: '#9F9CBB',
};

// The confirmation block follows the 2026 key art instead of the site chrome:
// hard-edged rectangles over a blue → violet → magenta ramp. A real
// linear-gradient, so it is a background-image — which a client forcing its own
// dark theme leaves untouched while it still darkens the text. That asymmetry
// is accepted here: every string inside the block is pure white, so a forced
// theme lands on black-on-gradient, which is legible if not ideal, rather than
// the muddy mid-tones a tinted grey inverts to. `solid` is the ramp's midpoint,
// shown by Outlook, which drops gradients outright.
const g = {
  ramp: 'linear-gradient(160deg,#1D4ED8 0%,#6D28D9 52%,#A21CAF 100%)',
  solid: '#6D28D9',
  panelFill: 'rgba(9,5,42,.32)',
  panelSolid: '#3E2192',
  chipFill: 'rgba(9,5,42,.24)',
  chipSolid: '#5C1EA9',
  edge: 'rgba(255,255,255,.28)',
  chipEdge: 'rgba(255,255,255,.36)',
  ink: '#FFFFFF',
};

const uiFont = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
const monoFont = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// Team colours mirror js/league-data.js. They are NOT read from mvl.teams:
// that table's color_a/color_b are stale for half the roster, so sourcing from
// it would put the wrong colour on the player's own team.
const teamColors: Record<string, [string, string]> = {
  'metarice-x': ['#3FE39A', '#0E7A4C'],
  'metarice-y': ['#7C3BFF', '#2E00A8'],
  thurstrap: ['#10E0D4', '#078D96'],
  gizmo: ['#FF3FB4', '#D50083'],
  gremlins: ['#3D9E2A', '#0D4E14'],
  ssvc: ['#FFE44D', '#D6A900'],
  s24: ['#F51642', '#B90025'],
  'secret': ['#FF9A05', '#FF5A00'],
};

const getServiceRoleKey = () => {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!secretKeys) return null;

  try {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    return parsed.default ?? null;
  } catch (_) {
    return null;
  }
};

type Checkin = {
  id: string;
  checkin_day: string;
  created_at: string;
  method: 'self' | 'qr' | 'legacy';
  email: string | null;
};

type Player = {
  id: string;
  display_name: string | null;
  surname: string | null;
  jersey_number: string | null;
};

type Game = {
  starts_at: string;
  opponent: string | null;
  venue: string | null;
};

type ConfirmationPayload = {
  checkin: Checkin;
  player: Player;
  team: { id: string; name: string | null };
  games: Game[];
  day_number: number | null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// Everything the player sees is in Manila time regardless of where their phone
// thinks it is — the games are at one venue in one timezone.
const manilaTime = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));

const manilaLongDate = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date(iso));

// checkin_day arrives as a bare YYYY-MM-DD, which Date parses as UTC midnight.
// Anchoring it to Manila midday keeps it on the right calendar day whichever
// way the formatter shifts it.
const dayToDate = (day: string) => `${day}T12:00:00+08:00`;

const methodLabel = (method: Checkin['method']) =>
  method === 'qr' ? 'Scanned at the registration booth' : 'Self check-in';

// Straight off the raffle mechanics poster. Mirrors raffle.drawDays in
// js/league-data.js — keep the two in step. Held here rather than read from the
// DB for the same reason as the team palette: the mail must render the same
// whether or not anything has been seeded.
const drawDays = [
  { label: 'Minor Raffle', when: 'Day 3 · Aug 31 and Day 4 · Sep 5' },
  { label: 'Major Raffle', when: 'Day 5 · Sep 6' },
];

const playerFullName = (player: Player) =>
  [player.display_name, player.surname].filter(Boolean).join(' ').trim();

const countWord = (n: number) =>
  ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n);

// The reason they are here. Named after the first fixture rather than the
// check-in, because that is what the player is actually turning up for.
const leadLine = (teamName: string, games: Game[]) => {
  if (!games.length) {
    return `${teamName} isn't on today's card, so grab a seat and enjoy the games.`;
  }
  const first = games[0];
  const plural = games.length === 1 ? 'one game' : `${countWord(games.length)} games`;
  return `${teamName} has ${plural} today &mdash; ` +
    `first serve ${manilaTime(first.starts_at)} against ${first.opponent ?? 'TBA'}` +
    // "Gameville Ball Park · Left Court" -> "Left Court"; the venue is already stated
    `${first.venue ? `, ${first.venue.replace(`${venue} · `, '')}` : ''}. Go get it.`;
};

// "Juan" out of "Juan Santos" — the headline is a greeting, not a record.
const firstName = (player: Player) =>
  (player.display_name ?? '').trim().split(/\s+/)[0] || 'Metarice friend';

const fineHeading = (label: string) =>
  `<p class="x-fine-lead" style="margin:16px 0 8px;color:${c.inkMuted};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">${label}</p>`;

const finePara = (body: string, lead?: string) =>
  `<p class="x-fine" style="margin:0 0 9px;color:${c.inkFaint};font:400 11px/1.55 ${uiFont};">` +
  (lead ? `<strong class="x-fine-lead" style="color:${c.inkMuted};font-weight:700;">${lead}</strong> ` : '') +
  `${body}</p>`;

const createEmailHtml = (payload: ConfirmationPayload) => {
  const { checkin, player, team, games, day_number } = payload;
  const safeFirst = escapeHtml(firstName(player));
  const safeTeam = escapeHtml(team.name ?? team.id);
  const [teamA] = teamColors[team.id] ?? [c.mint];

  const dayLabel = day_number ? `Game Day ${day_number}` : manilaLongDate(dayToDate(checkin.checkin_day));
  const checkedInAt = manilaTime(checkin.created_at);

  // The day's fixtures are the hero panel: kick-off big enough to read across a
  // gym, opponent and court under it, one hairline between entries.
  const gameRows = games.map((game, i) => `
                        <tr>
                          <td style="padding:${i ? '14px' : '0'} 0 0;${i ? `border-top:1px solid ${g.edge};` : ''}">
                            ${i ? '' : ''}<p class="x-ink" style="margin:${i ? '14px' : '0'} 0 2px;color:${g.ink};font:800 26px/1.1 ${uiFont};letter-spacing:-.3px;text-transform:uppercase;">${manilaTime(game.starts_at)}</p>
                            <p class="x-ink" style="margin:0;color:${g.ink};font:800 15px/1.35 ${uiFont};">vs ${escapeHtml(game.opponent ?? 'TBA')}</p>
                            <p class="x-ink" style="margin:2px 0 0;color:${g.ink};font:400 12px/1.4 ${uiFont};">${escapeHtml(game.venue ?? venue)}</p>
                          </td>
                        </tr>`).join('');

  // A player can check in on a day their own team is not playing — they are at
  // the venue either way, and the entry counts either way.
  const heroPanel = games.length
    ? `
                          <p class="x-ink" style="margin:0 0 14px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">${safeTeam} today</p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${gameRows}
                          </table>
                          <p class="x-ink" style="margin:16px 0 0;padding-top:14px;border-top:1px solid ${g.edge};color:${g.ink};font:400 12px/1.5 ${uiFont};">Checked in ${escapeHtml(checkedInAt)} at ${venue}.</p>`
    : `
                          <p class="x-ink" style="margin:0 0 10px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">You're checked in</p>
                          <p class="x-ink" style="margin:0 0 4px;color:${g.ink};font:800 22px/1.22 ${uiFont};letter-spacing:-.2px;text-transform:uppercase;">${escapeHtml(manilaLongDate(dayToDate(checkin.checkin_day)))}</p>
                          <p class="x-ink" style="margin:0;color:${g.ink};font:800 22px/1.22 ${uiFont};letter-spacing:-.2px;text-transform:uppercase;">Checked in ${escapeHtml(checkedInAt)}</p>
                          <p class="x-ink" style="margin:14px 0 0;padding-top:14px;border-top:1px solid ${g.edge};color:${g.ink};font:400 12px/1.5 ${uiFont};">${venue}</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Game on — MVL 2026</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }

  /* The mail is dark by design, so a client that forces its own dark theme
     makes it worse, not better: it flips the page to light and the type to
     near-black, while leaving background-image gradients untouched — which is
     how white headlines end up unreadable on the violet block.

     Declaring both schemes above stops Apple Mail and Outlook.com. The rest
     force it anyway by rewriting the inline style attributes, so the palette
     is restated here: a stylesheet rule with !important outranks a rewritten
     inline style, which is the only lever left. */
  @media (prefers-color-scheme: dark) {
    .x-page  { background-color: ${c.page} !important; }
    .x-block { background-color: ${g.solid} !important; background-image: ${g.ramp} !important; }
    .x-panel { background-color: ${g.panelFill} !important; }
    .x-chip  { background-color: ${g.chipFill} !important; }
    .x-cta   { background-color: ${c.mint} !important; }
    .x-cta a { color: ${c.page} !important; }
    .x-dot   { background-color: ${teamA} !important; }
    .x-ink, .x-ink a { color: ${g.ink} !important; }
    .x-fine          { color: ${c.inkFaint} !important; }
    .x-fine-lead     { color: ${c.inkMuted} !important; }
  }

  /* Outlook's apps stamp data-ogsc/data-ogsb on elements as they swap the
     original colour and background out. Those attributes are the only hook
     they expose for putting the values back. */
  [data-ogsc] .x-ink, [data-ogsc] .x-ink a { color: ${g.ink} !important; }
  [data-ogsc] .x-fine                      { color: ${c.inkFaint} !important; }
  [data-ogsc] .x-fine-lead                 { color: ${c.inkMuted} !important; }
  [data-ogsc] .x-cta a                     { color: ${c.page} !important; }
  [data-ogsb] .x-page  { background-color: ${c.page} !important; }
  [data-ogsb] .x-block { background-color: ${g.solid} !important; }
  [data-ogsb] .x-panel { background-color: ${g.panelSolid} !important; }
  [data-ogsb] .x-chip  { background-color: ${g.chipSolid} !important; }
  [data-ogsb] .x-cta   { background-color: ${c.mint} !important; }
  [data-ogsb] .x-dot   { background-color: ${teamA} !important; }
</style>
</head>
<body class="x-page" style="margin:0;padding:0;width:100%;background-color:${c.page};color:${c.ink};font-family:${uiFont};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">${leadLine(team.name ?? team.id, games)}</div>
  <table role="presentation" class="x-page" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.page}" style="background-color:${c.page};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">

          <!-- masthead -->
          <tr>
            <td align="center" style="padding:0 0 22px;">
              <img src="${siteUrl}/mvl/assets/hero-mvl-2026-logo.png" width="132" alt="Metarice Volleyball League 2026" style="display:block;width:132px;max-width:44%;height:auto;border:0;">
            </td>
          </tr>

          <!-- confirmation block: the key-art gradient, hard edges throughout.
               Every string in here is pure white — a forced dark theme darkens
               text but not the gradient, and black on the ramp still reads,
               where a tinted grey would invert to mud. -->
          <tr>
            <td class="x-block" bgcolor="${g.solid}" style="background-color:${g.solid};background-image:${g.ramp};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:32px 28px 26px;">
                    <p class="x-ink" style="margin:0 0 12px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2.4px;text-transform:uppercase;">Checked in &middot; ${escapeHtml(dayLabel)}</p>
                    <!-- 34px uppercase leaves ~319px of content box on a 375px
                         client; a long name is one unbreakable word wider than
                         that, so let it split rather than push the block.
                         word-wrap is the alias Outlook's Word engine reads. -->
                    <h1 class="x-ink" style="margin:0 0 18px;color:${g.ink};font:800 34px/1.04 ${uiFont};letter-spacing:-.6px;text-transform:uppercase;overflow-wrap:break-word;word-wrap:break-word;">Game on,<br>${safeFirst}</h1>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="x-dot" width="11" bgcolor="${teamA}" style="width:11px;height:11px;line-height:11px;font-size:0;background-color:${teamA};border-radius:999px;">&nbsp;</td>
                        <td class="x-ink" style="padding-left:9px;color:${g.ink};font:800 11px/1 ${uiFont};letter-spacing:2px;text-transform:uppercase;white-space:nowrap;">${safeTeam}</td>
                      </tr>
                    </table>
                    <p class="x-ink" style="margin:18px 0 0;color:${g.ink};font:400 15px/1.6 ${uiFont};">${leadLine(safeTeam, games)}</p>
                  </td>
                </tr>

                <!-- the day's fixtures: the reason they turned up -->
                <tr>
                  <td style="padding:0 28px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="x-panel" bgcolor="${g.panelSolid}" style="background-color:${g.panelFill};border:1px solid ${g.edge};">
                      <tr>
                        <td style="padding:20px;">${heroPanel}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- the raffle rides along: one line, not a section. Checking
                     in is about the league first. -->
                <tr>
                  <td style="padding:0 28px 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="x-chip" bgcolor="${g.chipSolid}" style="background-color:${g.chipFill};border:1px solid ${g.chipEdge};">
                      <tr>
                        <td style="padding:14px 16px;">
                          <span class="x-ink" style="display:block;color:${g.ink};font:800 12px/1.3 ${uiFont};letter-spacing:.4px;">You're in the raffle too</span>
                          <span class="x-ink" style="display:block;margin-top:4px;color:${g.ink};font:400 11.5px/1.5 ${uiFont};">${drawDays.map((draw) => `${draw.label} on ${draw.when}`).join('. ')}. You have to be there when your name is drawn.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- next step -->
                <tr>
                  <td style="padding:8px 28px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="x-cta" bgcolor="${c.mint}" style="background-color:${c.mint};">
                          <a href="${siteUrl}/mvl/schedule" style="display:block;padding:15px 28px;color:${c.page};font:800 12px/1 ${uiFont};letter-spacing:1.8px;text-transform:uppercase;text-decoration:none;">See the full schedule</a>
                        </td>
                      </tr>
                    </table>
                    <p class="x-ink" style="margin:18px 0 0;color:${g.ink};font:400 13px/1.6 ${uiFont};">Schedules, standings and game-day announcements land on <a class="x-ink" href="${mvlUrl}" style="color:${g.ink};font-weight:700;text-decoration:underline;">metaricevolley.ph</a> and <a class="x-ink" href="${instagramUrl}" style="color:${g.ink};font-weight:700;text-decoration:underline;">@metaricevolley</a>.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- the record of the check-in, kept as fineprint -->
          <tr>
            <td style="padding:22px 6px 0;">
              <p class="x-fine" style="margin:0 0 10px;color:${c.inkFaint};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">Your check-in record</p>
              ${fineHeading('How you checked in')}
              ${finePara(escapeHtml(methodLabel(checkin.method)))}
              ${finePara(`${escapeHtml(playerFullName(player) || firstName(player))}, ${safeTeam}.`, 'Recorded as')}
              ${fineHeading('How the raffle works')}
              ${finePara('Players must be present at the time their names are drawn to be eligible to win.', 'Eligibility.')}
              ${finePara('There are separate draws for Major and Minor raffle prizes, so every player is eligible to win both a Minor and a Major prize.', 'Two draws.')}
              ${finePara(drawDays.map((draw) => `${draw.label}: ${draw.when}.`).join(' '), 'Draw days.')}
              ${finePara('Each player gets one entry per game day — checking in again on the same day will not add another. Prizes are claimed at the venue.')}
              ${finePara(`Questions on the day? Find us at the registration booth, or message <a class="x-fine-lead" href="${instagramUrl}" style="color:${c.inkMuted};">@metaricevolley</a>.`)}
            </td>
          </tr>

          <!-- Mingu sits to the right of the sign-off. The asset is served at
               2x and sized down in the markup so it stays sharp on retina;
               width/height are attributes as well as CSS because Outlook sizes
               from the attributes. -->
          <tr>
            <td style="padding:22px 6px 8px;border-top:1px solid ${c.hairline};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="top" style="padding-right:14px;">
                    <p class="x-fine" style="margin:0;color:${c.inkFaint};font:400 11px/1.6 ${uiFont};">Metarice Volleyball League 2026 &middot; ${venue}<br>You're getting this because you checked in on an MVL 2026 game day. This is an automated confirmation email, so please do not reply. For official announcements, visit <a class="x-fine-lead" href="${mvlUrl}" style="color:${c.inkMuted};">${mvlUrl}</a> or follow <a class="x-fine-lead" href="${instagramUrl}" style="color:${c.inkMuted};">@metaricevolley</a>.</p>
                  </td>
                  <td width="88" valign="bottom" align="right" style="width:88px;">
                    <img src="${siteUrl}/mvl/mascot/Mingu-Hooray-email.png" width="88" height="119" alt="" style="display:block;width:88px;height:119px;border:0;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const createEmailText = (payload: ConfirmationPayload) => {
  const { checkin, player, team, games, day_number } = payload;
  const teamName = team.name ?? team.id;
  const dayLabel = day_number ? `Game Day ${day_number}` : manilaLongDate(dayToDate(checkin.checkin_day));

  const fixtures = games.length
    ? `${teamName.toUpperCase()} TODAY\n${games.map((game) =>
      `${manilaTime(game.starts_at)} - vs ${game.opponent ?? 'TBA'} (${game.venue ?? venue})`).join('\n')}`
    : `${manilaLongDate(dayToDate(checkin.checkin_day))}\n${venue}`;

  return `
Game on, ${firstName(player)}.

Checked in - ${dayLabel}
${teamName}

${leadLine(teamName, games).replace(/&mdash;/g, '-')}

${fixtures}

Checked in ${manilaTime(checkin.created_at)} at ${venue}.

YOU'RE IN THE RAFFLE TOO
${drawDays.map((draw) => `${draw.label} on ${draw.when}`).join('. ')}. You have to be
there when your name is drawn.

Full schedule: ${siteUrl}/mvl/schedule
Site: ${mvlUrl}
Instagram: ${instagramUrl}

This is an automated confirmation email, so please do not reply. For official
announcements, visit ${mvlUrl} or follow @metaricevolley.

--
YOUR CHECK-IN RECORD

How you checked in
${methodLabel(checkin.method)}

Recorded as
${playerFullName(player) || firstName(player)}, ${teamName}.

How the raffle works
Eligibility. Players must be present at the time their names are drawn to be
eligible to win.

Two draws. There are separate draws for Major and Minor raffle prizes, so every
player is eligible to win both a Minor and a Major prize.

Draw days. ${drawDays.map((draw) => `${draw.label}: ${draw.when}.`).join(' ')}

Each player gets one entry per game day - checking in again on the same day will
not add another. Prizes are claimed at the venue.

Questions on the day? Find us at the registration booth, or message
@metaricevolley.
`.trim();
};

const fetchConfirmationPayload = async (
  checkinId: string,
  serviceRoleKey: string,
): Promise<ConfirmationPayload | null> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured.');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mvl_get_checkin_confirmation_email_payload`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_checkin_id: checkinId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase fetch failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (!payload?.checkin || !payload?.player) return null;
  return payload as ConfirmationPayload;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const serviceRoleKey = getServiceRoleKey();
    const from = Deno.env.get('MVL_EMAIL_FROM') ?? defaultFrom;
    const replyTo = Deno.env.get('MVL_EMAIL_REPLY_TO');

    if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured.');
    if (!serviceRoleKey) throw new Error('Supabase service role key is not configured.');

    const { checkinId } = await req.json().catch(() => ({}));
    if (!checkinId || typeof checkinId !== 'string') {
      return jsonResponse({ error: 'checkinId is required.' }, 400);
    }

    const payload = await fetchConfirmationPayload(checkinId, serviceRoleKey);
    if (!payload) return jsonResponse({ error: 'Check-in not found.' }, 404);

    // A booth scan can check in a player with no address on file. That is a
    // normal outcome, not a failure — say so plainly rather than 4xx-ing at a
    // caller that cannot do anything about it.
    const to = payload.checkin.email?.trim();
    if (!to) return jsonResponse({ ok: true, skipped: 'no-email-on-file' });

    const teamName = payload.team.name ?? payload.team.id;
    const dayLabel = payload.day_number
      ? `Game Day ${payload.day_number}`
      : manilaLongDate(dayToDate(payload.checkin.checkin_day));

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        // keyed on the check-in row, and there is at most one per player per
        // day, so a retrying client cannot send a second copy
        'Idempotency-Key': `checkin-confirmation-${payload.checkin.id}`,
      },
      body: JSON.stringify({
        from,
        to,
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `${dayLabel} — you're checked in with ${teamName}`,
        html: createEmailHtml(payload),
        text: createEmailText(payload),
      }),
    });

    const resendBody = await resendResponse.json().catch(async () => ({
      message: await resendResponse.text(),
    }));

    if (!resendResponse.ok) {
      return jsonResponse({ error: 'Resend email failed.', details: resendBody }, 502);
    }

    return jsonResponse({ ok: true, resendId: resendBody.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});
