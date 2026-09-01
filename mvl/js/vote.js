/* ==========================================================================
   Special-award voting — /mvl/vote

   Identity first, then one award per screen, then the whole ballot goes up in
   a single call. Identity leads because it is what tells someone they have
   already voted; discovering that after picking four players would be worse.
   ========================================================================== */
const { teams: TEAMS, awards: AWARDS = [] } = window.MVL_DATA;
const cfg = window.MVL_SUPABASE || {};

const el = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
const cssUrl = (path) => `url('${String(path).replace(/'/g, "\\'")}')`;

const identityForm = el('voteIdentity');
const ballot = el('voteBallot');
const card = el('voteCard');
const slotClear = el('voteSlotClear');
const done = el('voteDone');
const railList = el('voteRail');
const nomineeTeam = el('voteNomineeTeam');
const nomineePlayer = el('voteNomineePlayer');
const slot = el('voteSlot');
const slotPhoto = el('voteSlotPhoto');
const slotCaption = el('voteSlotCaption');
const slotBrand = el('voteSlotBrand');
const nextBtn = el('voteNextBtn');
const backBtn = el('voteBackBtn');

const setStatus = (node, message, tone = '') => {
  if (!node) return;
  node.textContent = message || '';
  node.className = `form-status${tone ? ` is-${tone}` : ''}`;
};

// ---- state -------------------------------------------------------------------
let index = 0;                 // which award is on screen
const picks = new Map();       // award id -> { playerId, name, teamId, photo }
let nominees = [];              // every player, fetched once

// ---- api ---------------------------------------------------------------------
// Same anon-key RPC shape the check-in and waiver pages use.
const rpc = async (fn, body) => {
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(String(raw).split(':')[0].trim());
  }
  return payload;
};

// The message a raised exception should turn into. Anything unmapped falls
// through as-is rather than being swallowed.
const MESSAGES = {
  PLAYER_NOT_FOUND: 'We could not find that jersey number on that team. Check both and try again.',
  NO_EMAIL_ON_FILE: 'There is no email on file for that player, so we cannot verify it is you. Ask an organiser to add one.',
  EMAIL_MISMATCH: 'That email does not match the one on your league registration.',
  ALREADY_VOTED: 'You have already voted. One ballot per player.',
  UNKNOWN_NOMINEE: 'One of the players you picked is no longer on a roster. Refresh and try again.',
  NO_VOTES: 'Pick a player for at least one award before submitting.',
};
const explain = (error) => MESSAGES[error.message] || error.message || 'Something went wrong. Try again.';

const loadNominees = async () => {
  if (nominees.length) return nominees;
  const rows = await rpc('mvl_get_award_nominees', {});
  nominees = Array.isArray(rows) ? rows : [];
  return nominees;
};

const teamPlayers = (teamId) => nominees.filter((p) => p.teamId === teamId);

// ---- team pickers ------------------------------------------------------------
const teamOptions = TEAMS.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
el('voteTeam').insertAdjacentHTML('beforeend', teamOptions);
nomineeTeam.insertAdjacentHTML('beforeend', teamOptions);

// On mobile the picked player takes the card, so the award copy steps aside;
// clearing brings it back. Driven by a class rather than inline display so the
// desktop layout, which shows both at once, is unaffected.
const markPick = (has) => card.classList.toggle('has-pick', has);

// ---- the slot ----------------------------------------------------------------
// Mirrors the check-in confirmation card: the nominee's cut-out stands on the
// team's artwork, so the pick reads as a person rather than a row in a select.
const paintSlot = (award, pick) => {
  const team = pick ? teamById[pick.teamId] : null;
  if (team) {
    slot.style.setProperty('--team-a', team.grad[0]);
    slot.style.setProperty('--team-b', team.grad[1]);
    if (team.bg) slot.style.setProperty('--team-art', cssUrl(team.bg));
    else slot.style.removeProperty('--team-art');
  } else {
    slot.style.removeProperty('--team-a');
    slot.style.removeProperty('--team-b');
    slot.style.removeProperty('--team-art');
  }
  slot.classList.toggle('has-pick', Boolean(pick));
  markPick(Boolean(pick));
  slotClear.hidden = !pick;

  if (pick?.photo) {
    slotPhoto.src = pick.photo;
    slotPhoto.hidden = false;
    slotPhoto.onerror = () => { slotPhoto.hidden = true; };
  } else {
    slotPhoto.hidden = true;
    slotPhoto.removeAttribute('src');
  }

  slotCaption.textContent = pick
    ? `${pick.name}${pick.jersey ? ` · #${pick.jersey}` : ''} · ${team?.name || ''}`
    : 'Pick a player to see them here';

  if (award.logo) {
    slotBrand.src = award.logo;
    slotBrand.alt = award.brand ? `${award.brand}` : '';
    slotBrand.hidden = false;
  } else {
    slotBrand.hidden = true;
  }
};

// ---- rail --------------------------------------------------------------------
const renderRail = () => {
  railList.innerHTML = AWARDS.map((award, i) => {
    const pick = picks.get(award.id);
    return `
      <li>
        <button type="button" class="vote-rail-item${i === index ? ' is-current' : ''}${pick ? ' is-done' : ''}"
                data-award-index="${i}"${i > index && !picks.has(AWARDS[index]?.id) ? ' disabled' : ''}>
          <span class="vote-rail-name">${escapeHtml(award.name)}</span>
          <span class="vote-rail-pick">${pick ? escapeHtml(pick.name) : 'Not picked yet'}</span>
        </button>
      </li>
    `;
  }).join('');
};

// ---- one award on screen -----------------------------------------------------
const renderAward = async () => {
  const award = AWARDS[index];
  if (!award) return;

  el('voteBrand').textContent = award.brand ? `Presented by ${award.brand}` : '';
  el('voteAwardName').textContent = award.name;
  el('voteTagline').textContent = award.tagline || '';
  document.title = `${award.name} — Vote — MVL 2026`;
  el('voteBody').innerHTML = (award.body || []).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  el('voteQuestion').textContent = award.question || '';
  el('voteProgress').textContent = `Award ${index + 1} of ${AWARDS.length}`;

  const pick = picks.get(award.id);
  nomineeTeam.value = pick?.teamId || '';
  nomineePlayer.innerHTML = '<option value="">Select a player</option>';
  nomineePlayer.disabled = !pick?.teamId;
  if (pick?.teamId) {
    fillPlayers(pick.teamId);
    nomineePlayer.value = pick.playerId;
  }

  paintSlot(award, pick);
  backBtn.hidden = index === 0;
  nextBtn.disabled = !pick;
  nextBtn.textContent = index === AWARDS.length - 1 ? 'Submit ballot' : 'Next';
  renderRail();
};

const fillPlayers = (teamId) => {
  nomineePlayer.innerHTML = '<option value="">Select a player</option>' + teamPlayers(teamId)
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.jerseyNumber ? ` · #${escapeHtml(p.jerseyNumber)}` : ''}</option>`)
    .join('');
  nomineePlayer.disabled = false;
};

nomineeTeam.addEventListener('change', async () => {
  const teamId = nomineeTeam.value;
  picks.delete(AWARDS[index].id);
  nextBtn.disabled = true;
  paintSlot(AWARDS[index], null);
  renderRail();
  if (!teamId) {
    nomineePlayer.innerHTML = '<option value="">Select a player</option>';
    nomineePlayer.disabled = true;
    return;
  }
  fillPlayers(teamId);
});

nomineePlayer.addEventListener('change', () => {
  const award = AWARDS[index];
  const playerId = nomineePlayer.value;
  if (!playerId) {
    picks.delete(award.id);
    paintSlot(award, null);
    nextBtn.disabled = true;
    renderRail();
    return;
  }
  const player = nominees.find((p) => p.id === playerId);
  if (!player) return;
  const pick = {
    playerId,
    teamId: player.teamId,
    name: player.name,
    jersey: player.jerseyNumber || '',
    photo: player.photoUrl || '',
  };
  picks.set(award.id, pick);
  paintSlot(award, pick);
  nextBtn.disabled = false;
  renderRail();
});

slotClear.addEventListener('click', () => {
  const award = AWARDS[index];
  picks.delete(award.id);
  nomineeTeam.value = '';
  nomineePlayer.innerHTML = '<option value="">Select a player</option>';
  nomineePlayer.disabled = true;
  paintSlot(award, null);
  nextBtn.disabled = true;
  renderRail();
});

railList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-award-index]');
  if (!button || button.disabled) return;
  index = Number(button.dataset.awardIndex);
  renderAward();
});

backBtn.addEventListener('click', () => {
  if (index === 0) return;
  index -= 1;
  renderAward();
  ballot.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---- advancing ---------------------------------------------------------------
const showIdentity = () => {
  ballot.classList.add('is-hidden');
  identityForm.classList.remove('is-hidden');
  el('voteRecap').innerHTML = AWARDS.filter((a) => picks.has(a.id)).map((a) => `
    <li><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(picks.get(a.id).name)}</li>
  `).join('');
  identityForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

nextBtn.addEventListener('click', () => {
  if (index < AWARDS.length - 1) {
    index += 1;
    renderAward();
    ballot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  showIdentity();
});

el('voteEditBtn').addEventListener('click', () => {
  identityForm.classList.add('is-hidden');
  ballot.classList.remove('is-hidden');
  ballot.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---- submit ------------------------------------------------------------------
// Identity is checked here rather than up front, so someone who has already
// voted only finds out now — the trade for letting them see the awards first.
identityForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = el('voteIdentityStatus');
  const submitBtn = el('voteSubmitBtn');
  const team_id = el('voteTeam').value;
  const jersey_number = el('voteJersey').value.trim();
  const email = el('voteEmail').value.trim();

  if (!team_id || !jersey_number || !email) {
    setStatus(status, 'Fill in all three so we can find your registration.', 'error');
    return;
  }
  const cast = AWARDS.filter((a) => picks.has(a.id));
  if (!cast.length) {
    setStatus(status, MESSAGES.NO_VOTES, 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus(status, 'Sending your ballot…');
  try {
    const payload = await rpc('mvl_submit_award_votes', {
      p_team_id: team_id,
      p_jersey_number: jersey_number,
      p_email: email,
      p_votes: cast.map((a) => ({ award_id: a.id, nominee_player_id: picks.get(a.id).playerId })),
    });
    const name = [payload.player.display_name, payload.player.surname].filter(Boolean).join(' ');
    identityForm.classList.add('is-hidden');
    done.classList.remove('is-hidden');
    el('voteDoneTitle').textContent = `Thanks, ${name.split(' ')[0]}`;
    el('voteDoneSub').textContent = `${payload.votes} ${payload.votes === 1 ? 'vote' : 'votes'} recorded. Winners are announced on the final day.`;
    el('voteSummary').innerHTML = cast.map((a) => `
      <li><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(picks.get(a.id).name)}</li>
    `).join('');
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setStatus(status, explain(error), 'error');
    submitBtn.disabled = false;
  }
});

// ---- first paint ---------------------------------------------------------------
loadNominees()
  .then(() => renderAward())
  .catch((error) => setStatus(el('voteIdentityStatus'), explain(error), 'error'));
