const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const eventDates = 'August 29, 30, 31 and September 5, 6, 2026';
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
// hard-edged rectangles over a blue → violet → magenta ramp. Every stop is
// dark enough to hold white type (7:1 or better), and `solid` is the ramp's
// midpoint, which is what Outlook's Word engine shows since it drops gradients
// outright. Panel fills are translucent so they read against the whole ramp,
// each with an opaque bgcolor twin for the same reason.
// The block's key-art ramp. A real linear-gradient, so it is a background-image
// — which a client forcing its own dark theme leaves untouched while it still
// darkens the text. That asymmetry is accepted here: every string inside the
// block is pure white, so a forced theme lands on black-on-gradient, which is
// legible if not ideal, rather than the muddy mid-tones a tinted grey inverts
// to. `solid` is the ramp's midpoint, shown by Outlook, which drops gradients.
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
    `DESCRIPTION:Metarice Volleyball League 2026 — game days 1-3.\\nOfficial website: ${mvlUrl}\\nInstagram: ${instagramUrl}`,
    `URL:${mvlUrl}`,
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:mvl-2026-weekend-2@metaricevolley.ph',
    'DTSTAMP:20260802T000000Z',
    'DTSTART;VALUE=DATE:20260905',
    'DTEND;VALUE=DATE:20260907',
    'SUMMARY:MVL 2026 Weekend 2',
    `LOCATION:${venue}`,
    `DESCRIPTION:Metarice Volleyball League 2026 — game days 4-5.\\nOfficial website: ${mvlUrl}\\nInstagram: ${instagramUrl}`,
    `URL:${mvlUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
};

const base64 = (value: string) => {
  const bytes = encoder.encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

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
    `&details=${q(`${detail}\nOfficial website: ${mvlUrl}\nInstagram: ${instagramUrl}`)}`;
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
  `<p class="x-fine" style="margin:0 0 9px;color:${c.inkFaint};font:400 11px/1.55 ${uiFont};">` +
  (lead ? `<strong class="x-fine-lead" style="color:${c.inkMuted};font-weight:700;">${lead}</strong> ` : '') +
  `${body}</p>`;

const fineHeading = (label: string) =>
  `<p class="x-fine-lead" style="margin:16px 0 8px;color:${c.inkMuted};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">${label}</p>`;

const consentAndWaiverHtml = [
  fineHeading('Data Privacy'),
  finePara('Your details help us run the tournament: setting the schedule, keeping you posted on your games, and reaching your emergency contact if anything happens on court.'),
  finePara('MVL runs on the support of our official partners and sponsors, the same ones behind your jerseys, the raffle prizes, and the game-day giveaways. As part of joining, we share your name and email address with requesting sponsors so they can send you their offers, promos, and player perks.'),
  finePara(`You stay in control. Message us anytime at <a class="x-fine-lead" href="https://instagram.com/metaricevolley" style="color:${c.inkMuted};">@metaricevolley</a> to access, correct, or delete your information, or to stop hearing from our sponsors.`),
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

MVL runs on the support of our official partners and sponsors, the same ones behind your jerseys, the raffle prizes, and the game-day giveaways. As part of joining, we share your name and email address with requesting sponsors so they can send you their offers, promos, and player perks.

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
  const [teamA] = teamColors[submission.team_id] ?? [c.mint];

  const calendarRows = calendarLinks.map((link) => `
              <tr>
                <td class="x-chip" bgcolor="${g.chipSolid}" style="background-color:${g.chipFill};border:1px solid ${g.chipEdge};">
                  <a href="${link.href}" style="display:block;padding:13px 16px;text-decoration:none;">
                    <span class="x-ink" style="display:block;color:${g.ink};font:800 13px/1.3 ${uiFont};letter-spacing:.4px;">${link.title} &rarr;</span>
                    <span class="x-ink" style="display:block;margin-top:3px;color:${g.ink};font:400 11px/1.4 ${uiFont};">${link.note}</span>
                  </a>
                </td>
              </tr>
              <tr><td height="8" style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>You're in — MVL 2026</title>
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
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;line-height:0;opacity:0;">You're in with ${safeTeam}. Save the dates — Aug 29, 30, 31 and Sep 5, 6 at ${venue}.</div>
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
               where a tinted grey would inverts to mud. -->
          <tr>
            <td class="x-block" bgcolor="${g.solid}" style="background-color:${g.solid};background-image:${g.ramp};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:32px 28px 26px;">
                    <p class="x-ink" style="margin:0 0 12px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2.4px;text-transform:uppercase;">Registration confirmed</p>
                    <!-- 34px uppercase leaves ~319px of content box on a 375px
                         client; a long surname is one unbreakable word wider
                         than that, so let it split rather than push the block.
                         word-wrap is the alias Outlook's Word engine reads. -->
                    <h1 class="x-ink" style="margin:0 0 18px;color:${g.ink};font:800 34px/1.04 ${uiFont};letter-spacing:-.6px;text-transform:uppercase;overflow-wrap:break-word;word-wrap:break-word;">You're in,<br>${safeName}</h1>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="x-dot" width="11" bgcolor="${teamA}" style="width:11px;height:11px;line-height:11px;font-size:0;background-color:${teamA};border-radius:999px;">&nbsp;</td>
                        <td class="x-ink" style="padding-left:9px;color:${g.ink};font:800 11px/1 ${uiFont};letter-spacing:2px;text-transform:uppercase;white-space:nowrap;">${safeTeam}</td>
                      </tr>
                    </table>
                    <p class="x-ink" style="margin:18px 0 0;color:${g.ink};font:400 15px/1.6 ${uiFont};">Your waiver is signed and your slot in the 2026 Metarice Volleyball League is locked in. Here's everything you need before the first whistle.</p>
                  </td>
                </tr>

                <!-- when & where -->
                <tr>
                  <td style="padding:0 28px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="x-panel" bgcolor="${g.panelSolid}" style="background-color:${g.panelFill};border:1px solid ${g.edge};">
                      <tr>
                        <td style="padding:20px;">
                          <p class="x-ink" style="margin:0 0 10px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">Save the dates</p>
                          <p class="x-ink" style="margin:0 0 4px;color:${g.ink};font:800 22px/1.22 ${uiFont};letter-spacing:-.2px;text-transform:uppercase;">Aug 29, 30, 31</p>
                          <p class="x-ink" style="margin:0 0 14px;color:${g.ink};font:800 22px/1.22 ${uiFont};letter-spacing:-.2px;text-transform:uppercase;">Sep 5, 6 &middot; 2026</p>
                          <p class="x-ink" style="margin:0;padding-top:14px;border-top:1px solid ${g.edge};color:${g.ink};font:400 13px/1.5 ${uiFont};">
                            <span class="x-ink" style="color:${g.ink};font-weight:800;letter-spacing:1px;text-transform:uppercase;">${venue}</span><br>
                            <span class="x-ink" style="color:${g.ink};font-size:12px;">Use the links below for official MVL announcements.</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- calendar -->
                <tr>
                  <td style="padding:0 28px 12px;">
                    <p class="x-ink" style="margin:0 0 12px;color:${g.ink};font:700 10px/1 ${monoFont};letter-spacing:2px;text-transform:uppercase;">Add to your calendar</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${calendarRows}
                    </table>
                  </td>
                </tr>

                <!-- next step -->
                <tr>
                  <td style="padding:8px 28px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="x-cta" bgcolor="${c.mint}" style="background-color:${c.mint};">
                          <a href="${siteUrl}/mvl/rules" style="display:block;padding:15px 28px;color:${c.page};font:800 12px/1 ${uiFont};letter-spacing:1.8px;text-transform:uppercase;text-decoration:none;">Read the rules</a>
                        </td>
                      </tr>
                    </table>
                    <p class="x-ink" style="margin:18px 0 0;color:${g.ink};font:400 13px/1.6 ${uiFont};">Schedules, standings and game-day announcements land on <a class="x-ink" href="${mvlUrl}" style="color:${g.ink};font-weight:700;text-decoration:underline;">metaricevolley.ph</a> and <a class="x-ink" href="${instagramUrl}" style="color:${g.ink};font-weight:700;text-decoration:underline;">@metaricevolley</a>.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- the agreed record, kept as fineprint -->
          <tr>
            <td style="padding:22px 6px 0;">
              <p class="x-fine" style="margin:0 0 10px;color:${c.inkFaint};font:700 9px/1 ${monoFont};letter-spacing:1.6px;text-transform:uppercase;">Your copy of what you agreed to</p>
              ${consentAndWaiverHtml}
            </td>
          </tr>

          <!-- Mingu sits to the right of the sign-off. The asset is served at
               2x and sized down in the markup so it stays sharp on retina;
               width/height are attributes as well as CSS because Outlook sizes
               from the attributes. align="top" keeps him level with the first
               line if a client refuses to align the columns. -->
          <tr>
            <td style="padding:22px 6px 8px;border-top:1px solid ${c.hairline};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="top" style="padding-right:14px;">
                    <p class="x-fine" style="margin:0;color:${c.inkFaint};font:400 11px/1.6 ${uiFont};">Metarice Volleyball League 2026 &middot; ${venue}<br>You're getting this because you signed the MVL 2026 player waiver. This is an automated confirmation email, so please do not reply. For official announcements, visit <a class="x-fine-lead" href="${mvlUrl}" style="color:${c.inkMuted};">${mvlUrl}</a> or follow <a class="x-fine-lead" href="${instagramUrl}" style="color:${c.inkMuted};">@metaricevolley</a>.</p>
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

const createEmailText = (submission: WaiverSubmission, teamName: string) => {
  const fullName = `${submission.first_name} ${submission.last_name}`.trim() || 'Metarice friend';
  return `
You're in, ${fullName}.

Your waiver is signed and your slot in the 2026 Metarice Volleyball League is
locked in with ${teamName}.

SAVE THE DATES
${eventDates}

${venue}

ADD TO YOUR CALENDAR
${calendarLinks.map((link) => `${link.plain}\n${link.href}`).join('\n\n')}

Rules: ${siteUrl}/mvl/rules
Site: ${mvlUrl}
Instagram: ${instagramUrl}

This is an automated confirmation email, so please do not reply. For official
announcements, visit ${mvlUrl} or follow @metaricevolley.

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
    // A monitored mailbox for replies and an unsubscribe path both lift
    // deliverability, and the unsubscribe address is the standards-based
    // version of the "stop hearing from our sponsors" promise in the privacy
    // clause. Both stay off unless a real address is configured — inventing
    // one that bounces would cost more reputation than it earns.
    const replyTo = Deno.env.get('MVL_EMAIL_REPLY_TO');
    const unsubscribeTo = Deno.env.get('MVL_EMAIL_UNSUBSCRIBE_TO');

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
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `You're in — MVL 2026 with ${teamName}`,
        html: createEmailHtml(submission, teamName),
        text: createEmailText(submission, teamName),
        ...(unsubscribeTo
          ? {
            headers: {
              'List-Unsubscribe': `<mailto:${unsubscribeTo}?subject=Unsubscribe%20${submission.id}>`,
            },
          }
          : {}),
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
