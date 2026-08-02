// Renders the confirmation email straight out of index.ts so the preview can
// never drift from what Resend actually sends. Node strips the TypeScript and
// a stub stands in for the Deno globals; everything below Deno.serve is cut
// away since only the builders are needed.
//
//   node supabase/functions/send-waiver-confirmation/preview.mjs [team-id] [Team Name]
//
// Writes tmp/waiver-confirmation-email-preview.{html,txt} and the .ics.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');

const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
const builders =
  'globalThis.Deno = { env: { get: () => undefined } };\n' +
  src.replace(/Deno\.serve\([\s\S]*$/, '') +
  '\nexport { createEmailHtml, createEmailText, createIcs, calendarLinks };\n';

const shimmed = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mvl-email-')), 'builders.ts');
fs.writeFileSync(shimmed, builders);
const mod = await import(shimmed);

const [teamId = 'metarice-x', ...nameParts] = process.argv.slice(2);
const teamName = nameParts.join(' ') || 'Metarice X';
const submission = {
  id: 'preview',
  team_id: teamId,
  player_id: null,
  first_name: 'Juan',
  last_name: 'Santos',
  email: 'juan@example.com',
  submitted_at: new Date().toISOString(),
  fur_parent: null,
};

const out = path.join(repo, 'tmp');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'waiver-confirmation-email-preview.html'), mod.createEmailHtml(submission, teamName));
fs.writeFileSync(path.join(out, 'waiver-confirmation-email-preview.txt'), mod.createEmailText(submission, teamName));
fs.writeFileSync(path.join(out, 'waiver-confirmation.ics'), mod.createIcs());

console.log(`rendered ${teamName} -> tmp/waiver-confirmation-email-preview.html`);
for (const link of mod.calendarLinks) console.log(`  ${link.href}`);
