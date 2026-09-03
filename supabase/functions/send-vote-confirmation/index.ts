// Special-award vote confirmation.
//
// Built on send-checkin-confirmation: same palette, same key-art block, same
// forced-dark-theme locks, same Mingu sign-off, so the three mails read as one
// voice.
//
// What differs is the job. This one is a receipt for a ballot, and the thing
// worth showing is who the voter picked — so the hero is a card per award
// mirroring the /vote review screen: the nominee's cut-out over their team
// colour, the award above, the name and team below.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const siteUrl = Deno.env.get('MVL_SITE_URL') ?? 'https://metaricevolley.ph';
const mvlUrl = `${siteUrl}/mvl`;
const instagramUrl = 'https://instagram.com/metaricevolley';
const defaultFrom = 'MVL 2026 <mingu@metaricevolley.ph>';

// Every link is UTM-tagged so GA4 attributes the visit to email, to this
// campaign, and to the button clicked. Query before fragment: a UTM string
// written after `#` is swallowed by the fragment.
const utm = (path: string, content: string, fragment = '') =>
  `${path}?utm_source=resend&utm_medium=email&utm_campaign=mvl2026-vote-confirmation` +
  `&utm_content=${content}${fragment}`;

const c = {
  page: '#0B0730',
  footer: '#080522',
  hairline: '#2E2963',
  inkMuted: '#C3C0D8',
  inkFaint: '#9F9CBB',
};

const g = {
  ramp: 'linear-gradient(160deg,#1D4ED8 0%,#6D28D9 52%,#A21CAF 100%)',
  solid: '#6D28D9',
  panelFill: 'rgba(9,5,42,.32)',
  panelSolid: '#3E2192',
  edge: 'rgba(255,255,255,.28)',
  ink: '#FFFFFF',
};

const uiFont = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
const monoFont = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// Mirrors js/league-data.js. NOT read from mvl.teams: that table's
// color_a/color_b are stale for half the roster.
const teamColors: Record<string, [string, string]> = {
  'metarice-x': ['#3FE39A', '#0E7A4C'],
  'metarice-y': ['#7C3BFF', '#2E00A8'],
  thurstrap: ['#10E0D4', '#078D96'],
  gizmo: ['#FF3FB4', '#D50083'],
  gremlins: ['#3D9E2A', '#0D4E14'],
  ssvc: ['#FFE44D', '#D6A900'],
  s24: ['#F51642', '#B90025'],
  secret: ['#FF9A05', '#FF5A00'],
};

// Award names and their presenting brand live in js/league-data.js, which an
// edge function cannot read. Duplicated here on purpose; keep the two in step
// when an award is renamed or changes sponsor.
const awardNames: Record<string, string> = {
  'fresh-new-player': 'Fresh New Player of the League',
  'extra-strong-sigaw': 'Extra Strong Sigaw',
  'outstanding-sportsmanship': 'Outstanding Sportsmanship Award',
  'face-of-the-league': 'Face of the League',
};

const awardBrands: Record<string, string> = {
  'fresh-new-player': 'Future Glow',
  'extra-strong-sigaw': 'Strepsils',
  'outstanding-sportsmanship': 'Decathlon',
  'face-of-the-league': 'Garnier',
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

type Pick = {
  award_id: string;
  player_name: string;
  jersey_number: string | null;
  team_id: string | null;
  team_name: string | null;
  photo_url: string | null;
};

type VotePayload = {
  cast_at: string | null;
  voter: {
    display_name: string | null;
    surname: string | null;
    email: string | null;
    team_name: string | null;
  };
  picks: Pick[];
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// One card per award, two to a row.
//
// Text only. The nominee cut-outs are transparent WebP, and mail clients that
// will not composite that alpha paint the transparent pixels black — which put
// a black box around half the players instead of their team artwork. The team
// colour survives as a bar across the top of each card, so a ballot still
// reads at a glance without depending on an image rendering correctly.
const textCard = (pick: Pick | undefined) => {
  if (!pick) return '<td width="48%" style="width:48%;">&nbsp;</td>';
  const [a] = teamColors[pick.team_id ?? ''] ?? ['#3FE39A'];
  const award = [awardBrands[pick.award_id], awardNames[pick.award_id] ?? pick.award_id]
    .filter(Boolean).join(' ');
  const jersey = pick.jersey_number ? ` &middot; #${escapeHtml(pick.jersey_number)}` : '';
  return `
    <td width="48%" valign="top" style="width:48%;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td height="5" bgcolor="${a}" style="height:5px;line-height:5px;font-size:0;background-color:${a};">&nbsp;</td>
        </tr>
        <tr>
          <td bgcolor="${g.panelSolid}" style="background-color:${g.panelFill};border:1px solid ${g.edge};border-top:0;padding:14px 16px 16px;">
            <p class="x-ink" style="margin:0 0 8px;color:${g.ink};font:700 9px/1.4 ${monoFont};letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(award)}</p>
            <p class="x-ink" style="margin:0;color:${g.ink};font:800 17px/1.28 ${uiFont};letter-spacing:-.2px;">${escapeHtml(pick.player_name)}</p>
            <p class="x-ink" style="margin:4px 0 0;color:${g.ink};font:400 12px/1.4 ${uiFont};opacity:.78;">${escapeHtml(pick.team_name ?? '')}${jersey}</p>
          </td>
        </tr>
      </table>
    </td>`;
};

const pickGrid = (picks: Pick[]) => {
  const spacer = '<td width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>';
  let rows = '';
  for (let i = 0; i < picks.length; i += 2) {
    rows += `
      <tr>${textCard(picks[i])}${spacer}${textCard(picks[i + 1])}</tr>
      <tr><td colspan="3" height="14" style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>`;
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
};

const createEmailHtml = (payload: VotePayload) => {
  const first = (payload.voter.display_name ?? '').trim().split(' ')[0] || 'there';
  const n = payload.picks.length;
  const countLine = `${n} ${n === 1 ? 'vote' : 'votes'} recorded.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your MVL 2026 ballot is in</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .x-page  { background-color: ${c.page} !important; }
    .x-block { background-color: ${g.solid} !important; background-image: ${g.ramp} !important; }
    .x-panel { background-color: ${g.panelFill} !important; }
    .x-cta   { background-color: #7CF5B4 !important; }
    .x-cta a { color: ${c.page} !important; }
    .x-ink, .x-ink a { color: #FFFFFF !important; }
    .x-fine          { color: ${c.inkFaint} !important; }
    .x-fine-lead     { color: ${c.inkMuted} !important; }
  }
  [data-ogsc] .x-ink, [data-ogsc] .x-ink a { color: #FFFFFF !important; }
  [data-ogsc] .x-fine                      { color: ${c.inkFaint} !important; }
  [data-ogsc] .x-fine-lead                 { color: ${c.inkMuted} !important; }
  [data-ogsc] .x-cta a                     { color: ${c.page} !important; }
  [data-ogsb] .x-page  { background-color: ${c.page} !important; }
  [data-ogsb] .x-block { background-color: ${g.solid} !important; }
  [data-ogsb] .x-panel { background-color: ${g.panelSolid} !important; }
  [data-ogsb] .x-cta   { background-color: #7CF5B4 !important; }
</style>
</head>
<body class="x-page" style="margin:0;padding:0;width:100%;background-color:${c.page};color:#EDEBFF;font-family:${uiFont};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">${countLine} Here are the players you picked for the MVL 2026 special awards.</div>
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <table role="presentation" class="x-page" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.page}" style="background-color:${c.page};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">

          <tr>
            <td align="center" style="padding:0 0 22px;">
              <img src="${mvlUrl}/assets/hero-mvl-2026-logo.png" width="132" alt="Metarice Volleyball League 2026" style="display:block;width:132px;max-width:44%;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td class="x-block" bgcolor="${g.solid}" style="background-color:${g.solid};background-image:${g.ramp};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                <tr>
                  <td style="padding:32px 28px 22px;">
                    <p class="x-ink" style="margin:0 0 12px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2.4px;text-transform:uppercase;">MVL 2026 &bull; Special Awards</p>
                    <h1 class="x-ink" style="margin:0 0 16px;color:${g.ink};font:800 32px/1.06 ${uiFont};letter-spacing:-.6px;text-transform:uppercase;overflow-wrap:break-word;word-wrap:break-word;">Thanks, ${escapeHtml(first)}.<br>Your ballot<br>is in.</h1>
                    <p class="x-ink" style="margin:0;color:${g.ink};font:400 15px/1.6 ${uiFont};">${countLine} Here is who you picked.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 28px 8px;">
                    ${pickGrid(payload.picks)}
                  </td>
                </tr>

                <tr><td height="18" style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:0 28px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:rgba(255,255,255,.34);">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 28px 32px;">
                    <p class="x-ink" style="margin:0 0 18px;color:${g.ink};font:400 14px/1.6 ${uiFont};">Winners are announced on the final day at Gameville.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="border:2px solid #FFFFFF;">
                          <a class="x-ink" href="${utm(`${mvlUrl}/schedule`, 'schedule-cta', '#day-4')}" style="display:block;padding:15px 20px;color:${g.ink};font:800 14px/1 ${uiFont};letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;">See the schedule &rarr;</a>
                        </td>
                      </tr>
                    </table>
                    <p class="x-ink" style="margin:20px 0 0;color:${g.ink};font:800 15px/1.5 ${uiFont};">See you at Gameville. &#127806;&#127952;</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 6px 8px;border-top:1px solid ${c.hairline};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="top" style="padding-right:14px;">
                    <p class="x-fine" style="margin:0;color:${c.inkFaint};font:400 11px/1.6 ${uiFont};">Metarice Volleyball League 2026 &middot; Gameville Ball Park<br>You're getting this because you cast a vote for the MVL 2026 special awards. For official announcements, visit <a class="x-fine-lead" href="${utm(siteUrl, 'footer-site')}" style="color:${c.inkMuted};">metaricevolley.ph</a> or follow <a class="x-fine-lead" href="${instagramUrl}" style="color:${c.inkMuted};">@metaricevolley</a>.</p>
                  </td>
                  <td width="88" valign="bottom" align="right" style="width:88px;">
                    <img src="${mvlUrl}/mascot/Mingu-Hooray-email.png" width="88" height="119" alt="" style="display:block;width:88px;height:119px;border:0;">
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

const createEmailText = (payload: VotePayload) => {
  const first = (payload.voter.display_name ?? '').trim().split(' ')[0] || 'there';
  const n = payload.picks.length;
  const lines = [
    `Thanks, ${first}. Your ballot is in.`,
    '',
    `${n} ${n === 1 ? 'vote' : 'votes'} recorded. Here is who you picked:`,
    '',
    ...payload.picks.map((p) => {
      const award = awardNames[p.award_id] ?? p.award_id;
      const brand = awardBrands[p.award_id];
      const team = p.team_name ? ` (${p.team_name})` : '';
      return `${[brand, award].filter(Boolean).join(' ')}: ${p.player_name}${team}`;
    }),
    '',
    'Winners are announced on the final day at Gameville.',
    '',
    `Schedule: ${mvlUrl}/schedule`,
    'See you at Gameville.',
  ];
  return lines.join('\n');
};

const fetchVotePayload = async (
  voterPlayerId: string,
  serviceRoleKey: string,
): Promise<VotePayload | null> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured.');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mvl_get_vote_confirmation_email_payload`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_voter_player_id: voterPlayerId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase fetch failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (!payload?.voter || !Array.isArray(payload?.picks)) return null;
  return payload as VotePayload;
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

    const { voterPlayerId } = await req.json().catch(() => ({}));
    if (!voterPlayerId || typeof voterPlayerId !== 'string') {
      return jsonResponse({ error: 'voterPlayerId is required.' }, 400);
    }

    const payload = await fetchVotePayload(voterPlayerId, serviceRoleKey);
    if (!payload) return jsonResponse({ error: 'Ballot not found.' }, 404);
    if (!payload.picks.length) return jsonResponse({ ok: true, skipped: 'no-votes' });

    // The voter's address is what mvl.award_voter matched against, so it is
    // always present by the time a ballot exists. Guarded anyway rather than
    // handing Resend an empty recipient.
    const to = payload.voter.email?.trim();
    if (!to) return jsonResponse({ ok: true, skipped: 'no-email-on-file' });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        // Keyed on the ballot, not just the voter: a retrying client repeats the
        // key and Resend collapses it, while a voter whose ballot was cleared
        // and re-cast gets a new key and a fresh confirmation. Keying on the
        // voter alone silently swallowed the second send for 24 hours.
        'Idempotency-Key': `vote-confirmation-${voterPlayerId}-${payload.cast_at ?? 'na'}`,
      },
      body: JSON.stringify({
        from,
        to,
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: 'Your MVL 2026 ballot is in',
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
