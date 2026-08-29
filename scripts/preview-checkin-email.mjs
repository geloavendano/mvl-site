// Renders the check-in confirmation straight out of index.ts so the preview can
// never drift from what Resend actually sends. Node strips the TypeScript and
// a stub stands in for the Deno globals; everything below Deno.serve is cut
// away since only the builders are needed.
//
//   node scripts/preview-checkin-email.mjs [team-id] [--no-games] [--qr]
//
// Writes tmp/checkin-confirmation-email-preview.{html,txt}.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

const src = fs.readFileSync(path.join(repo, 'supabase/functions/send-checkin-confirmation/index.ts'), 'utf8');
const builders =
  'globalThis.Deno = { env: { get: () => undefined } };\n' +
  src.replace(/Deno\.serve\([\s\S]*$/, '') +
  '\nexport { createEmailHtml, createEmailText };\n';

const shimmed = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mvl-email-')), 'builders.ts');
fs.writeFileSync(shimmed, builders);
const mod = await import(shimmed);

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const teamId = args.find((a) => !a.startsWith('--')) ?? 'metarice-y';

// Mirrors a real game day: two fixtures on the same evening, two courts.
const games = flags.has('--no-games') ? [] : [
  { starts_at: '2026-08-29T08:00:00Z', opponent: 'Gremlins', venue: 'Gameville Ball Park · Court 1' },
  { starts_at: '2026-08-29T12:40:00Z', opponent: 'Gizmo Spikers', venue: 'Gameville Ball Park · Court 2' },
];

const teamNames = {
  'metarice-x': 'Metarice X',
  'metarice-y': 'Metarice Y',
  thurstrap: 'Thurstrap',
  gizmo: 'Gizmo Spikers',
  gremlins: 'Gremlins',
  ssvc: 'SSVC',
  s24: 'S24',
  secret: 'Secret',
};

const payload = {
  checkin: {
    id: 'preview',
    checkin_day: '2026-08-29',
    created_at: '2026-08-29T07:12:00Z', // 3:12 PM Manila
    method: flags.has('--qr') ? 'qr' : 'self',
    email: 'juan@example.com',
  },
  player: {
    id: 'preview-player',
    display_name: 'Juan',
    surname: 'Santos',
    jersey_number: '24',
  },
  team: { id: teamId, name: teamNames[teamId] ?? teamId },
  games,
  day_number: 1,
};

const out = path.join(repo, 'tmp');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'checkin-confirmation-email-preview.html'), mod.createEmailHtml(payload));
fs.writeFileSync(path.join(out, 'checkin-confirmation-email-preview.txt'), mod.createEmailText(payload));

console.log(`rendered ${payload.team.name} (${payload.checkin.method}, ${games.length} games)`);
console.log('  -> tmp/checkin-confirmation-email-preview.html');
