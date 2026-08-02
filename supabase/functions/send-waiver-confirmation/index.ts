const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const eventDates = 'August 29, 30, 31 and September 5, 6, 2026';
const venue = 'Gameville Ball Park';
const siteUrl = Deno.env.get('MVL_SITE_URL') ?? 'https://metaricevolley.ph';
const defaultFrom = 'MVL 2026 <registration@metaricevolley.ph>';

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

const foldIcsLine = (line: string) => {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  chunks.push(rest);
  return chunks.join('\r\n');
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

const googleCalendarUrl = (label: string, dates: string) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: label,
    dates,
    location: venue,
    details: 'Metarice Volleyball League 2026. Follow @metaricevolley and metaricevolley.ph for official announcements.',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const consentAndWaiverHtml = `
  <h2>Data Privacy</h2>
  <p>Your details help us run the tournament: setting the schedule, keeping you posted on your games, and reaching your emergency contact if anything happens on court.</p>
  <p>MVL runs on the support of our official partners and sponsors, the same ones behind your jerseys, the raffle prizes, and the game-day giveaways. As part of joining, we share your name and email address with them so they can send you their offers, promos, and player perks.</p>
  <p>You stay in control. Message us anytime at <a href="https://instagram.com/metaricevolley">@metaricevolley</a> to access, correct, or delete your information, or to stop hearing from our sponsors.</p>
  <p>By submitting the form, you consent to this use of your data.</p>
  <h2>Waiver and Release of Liability</h2>
  <p>In consideration of being allowed to participate in the 2026 Metarice Volleyball League, I acknowledge, appreciate, and agree to the following:</p>
  <h3>Assumption of Risk</h3>
  <p>I understand that participating in volleyball involves inherent risks, including, but not limited to, the risk of serious injury, disability, or death. I voluntarily assume all risks associated with participation in this tournament.</p>
  <h3>Medical Fitness</h3>
  <p>I certify that I am in good health and physically able to participate in this tournament. I have no medical condition that would make participation in this event inadvisable or unsafe. I acknowledge that it is my responsibility to consult with a physician prior to and regarding my participation in this tournament.</p>
  <h3>Release of Liability</h3>
  <p>I, on behalf of myself, my heirs, assigns, personal representatives, and next of kin, hereby release, discharge, and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, affiliates, and any other parties involved in the organization of this tournament from any and all claims, demands, losses, damages, and liabilities, arising out of or in connection with any injury, disability, or death that may occur as a result of my participation in this tournament.</p>
  <h3>Indemnification</h3>
  <p>I agree to indemnify and hold harmless Metarice Volleyball League, its organizers, volunteers, sponsors, and affiliates from any claims, demands, damages, costs, and expenses, including reasonable attorney's fees, arising out of or relating to my participation in the tournament or any breach of this agreement.</p>
  <h3>Photography and Media Release</h3>
  <p>I grant Metarice Volleyball League the right to take photographs, video, and other recordings of me during the tournament. I understand that these may be used for promotional purposes, including but not limited to social media, websites, and marketing materials, without compensation or further permission.</p>
  <h3>Understanding of Rules and Regulations</h3>
  <p>I agree to follow all rules, regulations, and instructions provided by the tournament organizers. I understand that failure to do so may result in my removal from the tournament without refund or compensation.</p>
  <p><strong>Acknowledgement:</strong> I acknowledge that I have read and fully understood this waiver and release of liability, and that by accomplishing this form, I am giving up substantial rights, including my right to sue. I understand that this waiver and release of liability shall be binding upon me, my heirs, assigns, and legal representatives.</p>
`;

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
  const deviceCalendarUrl = `${siteUrl}/mvl/assets/mvl-2026-dates.ics`;
  const googleWeekend1 = googleCalendarUrl('MVL 2026 Weekend 1', '20260829/20260901');
  const googleWeekend2 = googleCalendarUrl('MVL 2026 Weekend 2', '20260905/20260907');

  return `<!doctype html>
<html>
<body style="margin:0;background:#0b0730;color:#f7f4ff;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">You're officially registered for MVL 2026. Save the dates and we'll see you on court.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0b0730 0%,#214fa8 52%,#37d5bd 100%);padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#120e46;border:1px solid rgba(100,255,184,.42);border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35);">
          <tr>
            <td style="padding:28px 28px 18px;text-align:center;background:radial-gradient(circle at 50% 0%,rgba(96,242,161,.35),transparent 38%),linear-gradient(135deg,#160a4b,#244ca1);">
              <img src="${siteUrl}/mvl/assets/hero-mvl-2026-logo.png" width="170" alt="Metarice Volleyball League 2026" style="display:block;margin:0 auto 18px;max-width:46%;height:auto;">
              <p style="margin:0 0 8px;color:#64f2a1;font-size:13px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Registration Confirmed</p>
              <h1 style="margin:0;color:#ffffff;font-size:34px;line-height:1.02;letter-spacing:.5px;text-transform:uppercase;">You're in, ${safeName}!</h1>
              <p style="margin:14px auto 0;max-width:520px;color:#d9d4f8;font-size:17px;line-height:1.55;">You are officially registered for the <strong>2026 Metarice Volleyball League</strong> with <strong>${safeTeam}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid rgba(100,255,184,.3);border-radius:18px;background:#0c1229;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;color:#39d5c6;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Save the Dates</p>
                    <p style="margin:0;color:#ffffff;font-size:25px;font-weight:900;letter-spacing:1px;">${eventDates}</p>
                    <p style="margin:8px 0 0;color:#cfd0e8;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;">${venue}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 10px;">
                <tr>
                  <td style="padding:0 10px 10px 0;">
                    <a href="${googleWeekend1}" style="display:inline-block;background:#64f2a1;color:#0b0730;text-decoration:none;border-radius:999px;padding:13px 18px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;font-size:13px;">Google Calendar: Aug 29-31</a>
                  </td>
                  <td style="padding:0 0 10px 0;">
                    <a href="${googleWeekend2}" style="display:inline-block;background:#39d5c6;color:#0b0730;text-decoration:none;border-radius:999px;padding:13px 18px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;font-size:13px;">Google Calendar: Sep 5-6</a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:4px;">
                    <a href="${deviceCalendarUrl}" style="display:inline-block;border:2px solid #64f2a1;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;font-size:13px;">Apple / Outlook / Device Calendar</a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#d9d4f8;font-size:16px;line-height:1.6;">For official announcements, follow <a href="https://instagram.com/metaricevolley" style="color:#64f2a1;font-weight:800;">@metaricevolley</a> on Instagram and check <a href="${siteUrl}" style="color:#64f2a1;font-weight:800;">metaricevolley.ph</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 30px;">
              <div style="background:#0c1229;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:22px;color:#d9d4f8;font-size:14px;line-height:1.65;">
                <p style="margin:0 0 12px;color:#64f2a1;font-size:12px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">Consents and Waiver Agreed To</p>
                ${consentAndWaiverHtml}
              </div>
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
You're in, ${fullName}!

You are officially registered for the 2026 Metarice Volleyball League with ${teamName}.

Save the dates:
${eventDates}
Venue: ${venue}

Google Calendar Weekend 1:
${googleCalendarUrl('MVL 2026 Weekend 1', '20260829/20260901')}

Google Calendar Weekend 2:
${googleCalendarUrl('MVL 2026 Weekend 2', '20260905/20260907')}

Apple / Outlook / device calendar:
${siteUrl}/mvl/assets/mvl-2026-dates.ics

Follow @metaricevolley on Instagram for official announcements:
https://instagram.com/metaricevolley

Official website:
${siteUrl}

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
