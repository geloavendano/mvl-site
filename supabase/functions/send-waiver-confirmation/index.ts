const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const eventDates = 'August 29, 30, 31 and September 5, 6, 2026';
const venue = 'Gameville Ball Park';
const venueMapUrl = 'https://maps.app.goo.gl/sK1HuKBVwRSZPpHz9';
const siteUrl = Deno.env.get('MVL_SITE_URL') ?? 'https://metaricevolley.ph';
const defaultFrom = 'MVL 2026 <registration@metaricevolley.ph>';

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
  inkMuted: '#ADABC0',
  inkFaint: '#7F7C9B',
};

const uiFont = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
const monoFont = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// Team colours mirror js/league-data.js. They are NOT read from mvl.teams:
// that table's color_a/color_b are stale for half the roster (metarice-x,
// metarice-y, gremlins and s24 all still carry their pre-2026 jersey colours),
// so sourcing from it would put the wrong colour on the player's own team.
const teamColors: Record<string, [string, string]> = {
  'metarice-x': ['#3FE39A', '#0E7A4C'],
  'metarice-y': ['#7C3BFF', '#2E00A8'],
  thurstrap: ['#10E0D4', '#078D96'],
  gizmo: ['#FF3FB4', '#D50083'],
  gremlins: ['#3D9E2A', '#0D4E14'],
  ssvc: ['#FFE44D', '#D6A900'],
  s24: ['#F51642', '#B90025'],
  'up-leftout': ['#FF9A05', '#FF5A00'],
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

type WaiverSubmission = {
  id: string;
  team_id: string;
  player_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  submitted_at: string;
  fur_parent: string | null;
};

type Team = {
  id: string;
  name: string;
};

type ConfirmationPayload = {
  submission: WaiverSubmission;
  team: Team;
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

// RFC 5545 caps a line at 75 *octets*, not characters, and continuation lines
// open with one space. Counting characters would let a line of em dashes and
// accents run well past the limit, so measure the encoded length instead and
// never break mid-codepoint.
const encoder = new TextEncoder();
const foldIcsLine = (line: string) => {
  const out: string[] = [];
  let current = '';
  let limit = 75;
  for (const ch of line) {
    if (encoder.encode(current + ch).length > limit) {
      out.push(current);
      current = ` ${ch}`;
      limit = 74; // the leading space is part of the folded line
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join('\r\n');
};

const createIcs = () => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Metarice Volleyball League//MVL 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:mvl-2026-weekend-1@metaricevolley.ph',
    'DTSTAMP:20260802T000000Z',
    'DTSTART;VALUE=DATE:20260829',
    'DTEND;VALUE=DATE:20260901',
    'SUMMARY:MVL 2026 Weekend 1',
    `LOCATION:${venue}`,
    'DESCRIPTION:Metarice Volleyball League 2026 at Gameville Ball Park.',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:mvl-2026-weekend-2@metaricevolley.ph',
    'DTSTAMP:20260802T000000Z',
    'DTSTART;VALUE=DATE:20260905',
    'DTEND;VALUE=DATE:20260907',
    'SUMMARY:MVL 2026 Weekend 2',
    `LOCATION:${venue}`,
    'DESCRIPTION:Metarice Volleyball League 2026 at Gameville Ball Park.',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
};

const base64 = (value: string) => btoa(value);

// dates keeps its literal "/" and spaces encode as %20, matching the links
// already shipped on gametime.html. URLSearchParams would emit %2F and "+";
// both are legal, but there is no reason for the email to differ from the
// form the site has been using.
const googleCalendarUrl = (label: string, dates: string, detail: string) => {
  const q = (value: string) => encodeURIComponent(value);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${q(label)}` +
    `&dates=${dates}` +
    `&location=${q(venue)}` +
    `&details=${q(`${detail}\nVenue: ${venueMapUrl}`)}`;
};

const calendarLinks = [
  {
    href: `${siteUrl}/mvl/assets/mvl-2026-dates.ics`,
    title: 'Device calendar',
    plain: 'Device calendar (Apple, Outlook and more)',
    note: 'Apple, Outlook &amp; more &middot; both weekends at once (.ics, also attached)',
  },
  {
    href: googleCalendarUrl(
      'MVL 2026 · Metarice Volleyball League',
      '20260829/20260901',
      'Metarice Volleyball League 2026 — game days 1–3.',
    ),
    title: 'Google Calendar &middot; Weekend 1',
    plain: 'Google Calendar - Weekend 1 (Aug 29-31)',
    note: 'Aug 29 &ndash; 31',
  },
  {
    href: googleCalendarUrl(
      'MVL 2026 · Metarice Volleyball League',
      '20260905/20260907',
      'Metarice Volleyball League 2026 — game days 4–5.',
    ),
    title: 'Google Calendar &middot; Weekend 2',
    plain: 'Google Calendar - Weekend 2 (Sep 5-6)',
    note: 'Sep 5 &ndash; 6',
  },
];

// The record of what the player agreed to. Wording is verbatim from
// waiver.html and must stay that way — only the typography is set down to
// fineprint, since this is a receipt to keep rather than something to read.
const finePara = (body: string, lead?: string) =>
  `<p style="margin:0 0 9px;color:${c.inkFaint};font:400 11px/1.55 ${uiFont};">` +
  (lead ? `<strong style="color:${c.inkMuted};font-weight:700;">${lead}</strong> ` : '') +
  `${body}</p>`;

const fineHeading = (label: string) =>
  `<p style="margin:16px 0 8px;color:${c.inkMuted};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">${label}</p>`;

const consentAndWaiverHtml = [
  fineHeading('Data Privacy'),
  finePara('Your details help us run the tournament: setting the schedule, keeping you posted on your games, and reaching your emergency contact if anything happens on court.'),
  finePara('MVL runs on the support of our official partners and sponsors, the same ones behind your jerseys, the raffle prizes, and the game-day giveaways. As part of joining, we share your name and email address with them so they can send you their offers, promos, and player perks.'),
  finePara(`You stay in control. Message us anytime at <a href="https://instagram.com/metaricevolley" style="color:${c.inkMuted};">@metaricevolley</a> to access, correct, or delete your information, or to stop hearing from our sponsors.`),
  finePara('By submitting the form, you consent to this use of your data.'),
  fineHeading('Waiver and Release of Liability'),
  finePara('In consideration of being allowed to participate in the 2026 Metarice Volleyball League, I acknowledge, appreciate, and agree to the following:'),
  finePara('I understand that participating in volleyball involves inherent risks, including, but not limited to, the risk of serious injury, disability, or death. I voluntarily assume all risks associated with participation in this tournament.', 'Assumption of Risk.'),
  finePara('I certify that I am in good health and physically able to participate in this tournament. I have no medical condition that would make participation in this event inadvisable or unsafe. I acknowledge that it is my responsibility to consult with a physician prior to and regarding my participation in this tournament.', 'Medical Fitness.'),
  finePara('I, on behalf of myself, my heirs, assigns, personal representatives, and next of kin, hereby release, discharge, and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, affiliates, and any other parties involved in the organization of this tournament from any and all claims, demands, losses, damages, and liabilities, arising out of or in connection with any injury, disability, or death that may occur as a result of my participation in this tournament.', 'Release of Liability.'),
  finePara("I agree to indemnify and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, and affiliates from any claims, demands, damages, costs, and expenses, including reasonable attorney's fees, arising out of or relating to my participation in the tournament or any breach of this agreement.", 'Indemnification.'),
  finePara('I grant Metarice Volleyball League the right to take photographs, video, and other recordings of me during the tournament. I understand that these may be used for promotional purposes, including but not limited to social media, websites, and marketing materials, without compensation or further permission.', 'Photography and Media Release.'),
  finePara('I agree to follow all rules, regulations, and instructions provided by the tournament organizers. I understand that failure to do so may result in my removal from the tournament without refund or compensation.', 'Understanding of Rules and Regulations.'),
  finePara('I acknowledge that I have read and fully understood this waiver and release of liability, and that by accomplishing this form, I am giving up substantial rights, including my right to sue. I understand that this waiver and release of liability shall be binding upon me, my heirs, assigns, and legal representatives.', 'Acknowledgement.'),
].join('');

const consentAndWaiverText = `
Data Privacy
Your details help us run the tournament: setting the schedule, keeping you posted on your games, and reaching your emergency contact if anything happens on court.

MVL runs on the support of our official partners and sponsors, the same ones behind your jerseys, the raffle prizes, and the game-day giveaways. As part of joining, we share your name and email address with them so they can send you their offers, promos, and player perks.

You stay in control. Message us anytime at @metaricevolley to access, correct, or delete your information, or to stop hearing from our sponsors.

By submitting the form, you consent to this use of your data.

Waiver and Release of Liability
In consideration of being allowed to participate in the 2026 Metarice Volleyball League, I acknowledge, appreciate, and agree to the following:

Assumption of Risk
I understand that participating in volleyball involves inherent risks, including, but not limited to, the risk of serious injury, disability, or death. I voluntarily assume all risks associated with participation in this tournament.

Medical Fitness
I certify that I am in good health and physically able to participate in this tournament. I have no medical condition that would make participation in this event inadvisable or unsafe. I acknowledge that it is my responsibility to consult with a physician prior to and regarding my participation in this tournament.

Release of Liability
I, on behalf of myself, my heirs, assigns, personal representatives, and next of kin, hereby release, discharge, and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, affiliates, and any other parties involved in the organization of this tournament from any and all claims, demands, losses, damages, and liabilities, arising out of or in connection with any injury, disability, or death that may occur as a result of my participation in this tournament.

Indemnification
I agree to indemnify and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, and affiliates from any claims, demands, damages, costs, and expenses, including reasonable attorney's fees, arising out of or relating to my participation in the tournament or any breach of this agreement.

Photography and Media Release
I grant Metarice Volleyball League the right to take photographs, video, and other recordings of me during the tournament. I understand that these may be used for promotional purposes, including but not limited to social media, websites, and marketing materials, without compensation or further permission.

Understanding of Rules and Regulations
I agree to follow all rules, regulations, and instructions provided by the tournament organizers. I understand that failure to do so may result in my removal from the tournament without refund or compensation.

Acknowledgement
I acknowledge that I have read and fully understood this waiver and release of liability, and that by accomplishing this form, I am giving up substantial rights, including my right to sue. I understand that this waiver and release of liability shall be binding upon me, my heirs, assigns, and legal representatives.
`.trim();

const createEmailHtml = (submission: WaiverSubmission, teamName: string) => {
  const fullName = `${submission.first_name} ${submission.last_name}`.trim();
  const safeName = escapeHtml(fullName || 'Metarice friend');
  const safeTeam = escapeHtml(teamName);
  const [teamA, teamB] = teamColors[submission.team_id] ?? [c.mint, c.teal];

  // Every fill carries a bgcolor twin: Outlook's Word engine drops gradients
  // outright, and a lost background here means white text on white.
  const calendarRows = calendarLinks.map((link) => `
              <tr>
                <td bgcolor="${c.tonal}" style="background-color:${c.tonal};border:1px solid ${c.hairline};border-radius:12px;">
                  <a href="${link.href}" style="display:block;padding:13px 16px;text-decoration:none;">
                    <span style="display:block;color:${c.mint};font:700 13px/1.3 ${uiFont};letter-spacing:.4px;">${link.title}</span>
                    <span style="display:block;margin-top:3px;color:${c.inkFaint};font:400 11px/1.4 ${uiFont};">${link.note}</span>
                  </a>
                </td>
              </tr>
              <tr><td height="8" style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>You're in — MVL 2026</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${c.page};color:${c.ink};font-family:${uiFont};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">You're in with ${safeTeam}. Save the dates — Aug 29, 30, 31 and Sep 5, 6 at ${venue}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.page}" style="background-color:${c.page};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">

          <!-- masthead -->
          <tr>
            <td align="center" style="padding:0 0 22px;">
              <img src="${siteUrl}/mvl/assets/hero-mvl-2026-logo.png" width="132" alt="Metarice Volleyball League 2026" style="display:block;width:132px;max-width:44%;height:auto;border:0;">
            </td>
          </tr>

          <!-- confirmation card, capped by the player's team colour -->
          <tr>
            <td bgcolor="${c.card}" style="background-color:${c.card};border-radius:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td bgcolor="${teamA}" height="5" style="height:5px;line-height:5px;font-size:0;background-color:${teamA};background-image:linear-gradient(90deg,${teamA},${teamB});border-radius:24px 24px 0 0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 26px;">
                    <p style="margin:0 0 12px;color:${c.mint};font:700 10px/1 ${monoFont};letter-spacing:2.4px;text-transform:uppercase;">Registration confirmed</p>
                    <h1 style="margin:0 0 16px;color:#FFFFFF;font:800 32px/1.08 ${uiFont};letter-spacing:-.4px;">You're in, ${safeName}.</h1>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.tonal}" style="background-color:${c.tonal};border:1px solid ${c.hairline};border-radius:999px;">
                      <tr>
                        <td style="padding:8px 15px 8px 12px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="12" bgcolor="${teamA}" style="width:12px;height:12px;line-height:12px;font-size:0;background-color:${teamA};background-image:linear-gradient(135deg,${teamA},${teamB});border-radius:4px;">&nbsp;</td>
                              <td style="padding-left:9px;color:#FFFFFF;font:800 11px/1 ${uiFont};letter-spacing:1.8px;text-transform:uppercase;white-space:nowrap;">${safeTeam}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0;color:${c.inkMuted};font:400 15px/1.6 ${uiFont};">Your waiver is signed and your slot in the 2026 Metarice Volleyball League is locked in. Here's everything you need before the first whistle.</p>
                  </td>
                </tr>

                <!-- when & where -->
                <tr>
                  <td style="padding:0 28px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.tonal}" style="background-color:${c.tonal};border:1px solid ${c.hairline};border-radius:16px;">
                      <tr>
                        <td style="padding:20px;">
                          <p style="margin:0 0 8px;color:${c.teal};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">Save the dates</p>
                          <p style="margin:0 0 4px;color:#FFFFFF;font:800 21px/1.25 ${uiFont};letter-spacing:-.2px;">Aug 29, 30, 31</p>
                          <p style="margin:0 0 14px;color:#FFFFFF;font:800 21px/1.25 ${uiFont};letter-spacing:-.2px;">Sep 5, 6 &middot; 2026</p>
                          <p style="margin:0;padding-top:14px;border-top:1px solid ${c.hairline};color:${c.inkMuted};font:400 13px/1.5 ${uiFont};">
                            <a href="${venueMapUrl}" style="color:${c.mint};font-weight:700;text-decoration:none;">${venue} &rarr;</a><br>
                            <span style="color:${c.inkFaint};font-size:12px;">Tap for directions on Google Maps</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- calendar -->
                <tr>
                  <td style="padding:0 28px 12px;">
                    <p style="margin:0 0 12px;color:${c.inkMuted};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">Add to your calendar</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${calendarRows}
                    </table>
                  </td>
                </tr>

                <!-- next step -->
                <tr>
                  <td style="padding:8px 28px 30px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td bgcolor="${c.mint}" style="background-color:${c.mint};border-radius:999px;">
                          <a href="${siteUrl}/mvl/rules" style="display:block;padding:14px 26px;color:${c.page};font:800 12px/1 ${uiFont};letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;">Read the rules</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;color:${c.inkMuted};font:400 13px/1.6 ${uiFont};">Schedules, standings and game-day announcements land on <a href="${siteUrl}/mvl" style="color:${c.mint};font-weight:700;text-decoration:none;">metaricevolley.ph</a> and <a href="https://instagram.com/metaricevolley" style="color:${c.mint};font-weight:700;text-decoration:none;">@metaricevolley</a>.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- the agreed record, kept as fineprint -->
          <tr>
            <td style="padding:22px 6px 0;">
              <p style="margin:0 0 10px;color:${c.inkFaint};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">Your copy of what you agreed to</p>
              ${consentAndWaiverHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:22px 6px 8px;border-top:1px solid ${c.hairline};">
              <p style="margin:0;color:${c.inkFaint};font:400 11px/1.6 ${uiFont};">Metarice Volleyball League 2026 &middot; ${venue}<br>You're getting this because you signed the MVL 2026 player waiver.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const createEmailText = (submission: WaiverSubmission, teamName: string) => {
  const fullName = `${submission.first_name} ${submission.last_name}`.trim() || 'Metarice friend';
  return `
You're in, ${fullName}.

Your waiver is signed and your slot in the 2026 Metarice Volleyball League is
locked in with ${teamName}.

SAVE THE DATES
${eventDates}

${venue}
Directions: ${venueMapUrl}

ADD TO YOUR CALENDAR
${calendarLinks.map((link) => `${link.plain}\n${link.href}`).join('\n\n')}

Rules: ${siteUrl}/mvl/rules
Site: ${siteUrl}/mvl
Instagram: https://instagram.com/metaricevolley

--
YOUR COPY OF WHAT YOU AGREED TO

${consentAndWaiverText}
`.trim();
};

const fetchConfirmationPayload = async (
  submissionId: string,
  serviceRoleKey: string,
): Promise<ConfirmationPayload | null> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured.');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/mvl_get_waiver_confirmation_email_payload`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_submission_id: submissionId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase fetch failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  if (!payload?.submission || !payload?.team) return null;
  return payload as ConfirmationPayload;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const serviceRoleKey = getServiceRoleKey();
    const from = Deno.env.get('MVL_EMAIL_FROM') ?? defaultFrom;

    if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured.');
    if (!serviceRoleKey) throw new Error('Supabase service role key is not configured.');

    const { submissionId } = await req.json().catch(() => ({}));
    if (!submissionId || typeof submissionId !== 'string') {
      return jsonResponse({ error: 'submissionId is required.' }, 400);
    }

    const payload = await fetchConfirmationPayload(submissionId, serviceRoleKey);
    if (!payload) return jsonResponse({ error: 'Waiver submission not found.' }, 404);
    const { submission, team } = payload;
    const teamName = team.name ?? submission.team_id;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `waiver-confirmation-${submission.id}`,
      },
      body: JSON.stringify({
        from,
        to: submission.email,
        subject: 'You are registered for MVL 2026',
        html: createEmailHtml(submission, teamName),
        text: createEmailText(submission, teamName),
        attachments: [
          {
            filename: 'MVL-2026-Save-the-Dates.ics',
            content: base64(createIcs()),
          },
        ],
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
