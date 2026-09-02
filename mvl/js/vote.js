/* ==========================================================================
   Special-award voting — /mvl/vote

   A dedicated intro leads into one award per screen. Identity comes after the
   picks, then the whole ballot goes up in a single call.
   ========================================================================== */
const { teams: TEAMS, awards: AWARDS = [] } = window.MVL_DATA;
const cfg = window.MVL_SUPABASE || {};

const el = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
const VOTER_TEAMS = TEAMS.some((team) => team.id === 'organizer')
  ? TEAMS
  : [...TEAMS, { id: 'organizer', name: 'Organizer' }];
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
const copyBrand = el('voteCopyBrand');
const nextBtn = el('voteNextBtn');
const backBtn = el('voteBackBtn');
const startBtn = el('voteStartBtn');
const stepStatus = el('voteStepStatus');
const nomineeTeamField = el('voteNomineeTeamField');
const nomineePlayerField = el('voteNomineePlayerField');

const setStage = (stage) => {
  document.body.classList.remove('vote-stage-intro', 'vote-stage-active', 'vote-stage-review', 'vote-stage-done');
  document.body.classList.add(`vote-stage-${stage}`);
};

startBtn?.addEventListener('click', () => {
  setStage('active');
  window.scrollTo(0, 0);
});

const setStatus = (node, message, tone = '') => {
  if (!node) return;
  node.textContent = message || '';
  node.className = `form-status${tone ? ` is-${tone}` : ''}`;
};

const clearStepError = () => {
  stepStatus.textContent = '';
  stepStatus.classList.remove('is-error');
  stepStatus.hidden = true;
  [nomineeTeamField, nomineePlayerField].forEach((field) => field.classList.remove('is-error'));
  [nomineeTeam, nomineePlayer].forEach((control) => control.removeAttribute('aria-invalid'));
};

const showStepStatus = (message, tone = '') => {
  stepStatus.textContent = message;
  stepStatus.classList.toggle('is-error', tone === 'error');
  stepStatus.hidden = !message;
};

const showStepError = (field, control, message) => {
  clearStepError();
  field.classList.add('is-error');
  control.setAttribute('aria-invalid', 'true');
  showStepStatus(message, 'error');
  control.focus();
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
  if (!nominees.length) throw new Error('No players are available for voting yet.');
  return nominees;
};

// An award may restrict who can be nominated. Today only Fresh New Player
// does: mvl.players.is_repeat marks anyone who appeared in 2024 or 2025.
const eligible = (award) => (award?.newPlayersOnly ? nominees.filter((p) => !p.isRepeat) : nominees);
const teamPlayers = (teamId, award = AWARDS[index]) =>
  eligible(award).filter((p) => p.teamId === teamId);

// ---- team pickers ------------------------------------------------------------
// Organizers are valid test voters, but remain excluded from the public nominee
// selectors, team pages, standings and schedule.
const teamOptions = VOTER_TEAMS.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
el('voteTeam').insertAdjacentHTML('beforeend', teamOptions);

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
  slot.classList.toggle('has-photo', Boolean(pick?.photo));
  markPick(Boolean(pick));
  slotClear.hidden = !pick;

  if (pick?.photo) {
    slotPhoto.src = pick.photo;
    slotPhoto.hidden = false;
    slotPhoto.onerror = () => {
      slotPhoto.hidden = true;
      slot.classList.remove('has-photo');
    };
  } else {
    slotPhoto.hidden = true;
    slotPhoto.removeAttribute('src');
    slot.classList.remove('has-photo');
  }

  slotCaption.textContent = pick
    ? `${pick.name}${pick.jersey ? ` · #${pick.jersey}` : ''} · ${team?.name || ''}`
    : 'Pick a player to see them here';

  const awardLogos = Array.isArray(award.logos) && award.logos.length
    ? award.logos
    : (award.logo ? [{ name: award.brand, logo: award.logo, logoBg: award.logoBg }] : []);
  const logoMarkup = awardLogos.map((item) => `
    <img class="vote-brand-logo${item.logoBg ? ' has-logo-bg' : ''}"
         src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.name || '')}">
  `).join('');
  [slotBrand, copyBrand].forEach((lockup) => {
    lockup.innerHTML = logoMarkup;
    lockup.hidden = !awardLogos.length;
    lockup.classList.toggle('is-group', awardLogos.length > 1);
  });
  slot.classList.toggle('has-brand-group', awardLogos.length > 1);
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

  clearStepError();

  el('voteBrand').textContent = award.brand ? `Presented by ${award.brand}` : '';
  el('voteAwardName').textContent = award.name;
  el('voteTagline').textContent = award.tagline || '';
  document.title = `${award.name} — Vote — MVL 2026`;
  el('voteBody').innerHTML = (award.body || []).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  el('voteQuestion').textContent = award.question || '';
  el('voteProgress').textContent = `Award ${index + 1} of ${AWARDS.length}`;
  el('voteEligibility').textContent = award.eligibilityNote || '';
  el('voteEligibility').hidden = !award.eligibilityNote;

  // Rebuilt per award: a team with nobody eligible would be a dead end, so it
  // is not offered at all.
  const withNominees = new Set(eligible(award).map((p) => p.teamId));
  nomineeTeam.innerHTML = '<option value="">Select a team</option>' + TEAMS
    .filter((team) => withNominees.has(team.id))
    .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
    .join('');

  const pick = picks.get(award.id);
  nomineeTeam.value = pick?.teamId || '';
  nomineePlayer.innerHTML = `<option value="">${pick?.teamId ? 'Select a player' : 'Select a team first'}</option>`;
  nomineePlayer.disabled = !pick?.teamId;
  if (pick?.teamId) {
    fillPlayers(pick.teamId);
    nomineePlayer.value = pick.playerId;
  }

  paintSlot(award, pick);
  backBtn.hidden = index === 0;
  nextBtn.textContent = index === AWARDS.length - 1 ? 'Review ballot' : 'Next';
  renderRail();
};

const fillPlayers = (teamId) => {
  const players = teamPlayers(teamId);
  if (!players.length) {
    nomineePlayer.innerHTML = '<option value="">No players available</option>';
    nomineePlayer.disabled = true;
    showStepError(nomineeTeamField, nomineeTeam, 'No eligible players are available for this team. Select another team.');
    return false;
  }
  nomineePlayer.innerHTML = '<option value="">Select a player</option>' + players
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.jerseyNumber ? ` · #${escapeHtml(p.jerseyNumber)}` : ''}</option>`)
    .join('');
  nomineePlayer.disabled = false;
  return true;
};

nomineeTeam.addEventListener('change', async () => {
  clearStepError();
  const teamId = nomineeTeam.value;
  picks.delete(AWARDS[index].id);
  paintSlot(AWARDS[index], null);
  renderRail();
  if (!teamId) {
    nomineePlayer.innerHTML = '<option value="">Select a team first</option>';
    nomineePlayer.disabled = true;
    return;
  }
  fillPlayers(teamId);
});

nomineePlayer.addEventListener('change', () => {
  clearStepError();
  const award = AWARDS[index];
  const playerId = nomineePlayer.value;
  if (!playerId) {
    picks.delete(award.id);
    paintSlot(award, null);
    renderRail();
    return;
  }
  const player = eligible(AWARDS[index]).find((p) => p.id === playerId);
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
  renderRail();
});

slotClear.addEventListener('click', () => {
  clearStepError();
  const award = AWARDS[index];
  picks.delete(award.id);
  nomineeTeam.value = '';
  nomineePlayer.innerHTML = '<option value="">Select a team first</option>';
  nomineePlayer.disabled = true;
  paintSlot(award, null);
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

// ---- review cards ------------------------------------------------------------
const renderPickCards = (container, awards) => {
  container.innerHTML = awards.map((a) => {
    const pick = picks.get(a.id);
    const team = teamById[pick.teamId];
    const awardLabel = [a.brand, a.name].filter(Boolean).join(' ');
    const cardStyle = [
      `--team-a:${team?.grad?.[0] || '#3fe39a'}`,
      `--team-b:${team?.grad?.[1] || '#101a36'}`,
      team?.bg ? `--team-art:${cssUrl(team.bg)}` : '',
    ].filter(Boolean).join(';');
    return `
      <li class="vote-review-card${pick.photo ? ' has-photo' : ''}" style="${escapeHtml(cardStyle)}">
        ${pick.photo ? `<img class="vote-review-photo" src="${escapeHtml(pick.photo)}" alt="">` : ''}
        <svg class="vote-review-silhouette" viewBox="0 0 120 140" aria-hidden="true">
          <path fill="currentColor" d="M60 18a24 24 0 1 1 0 48 24 24 0 0 1 0-48Zm0 58c26 0 47 17 47 38v6H13v-6c0-21 21-38 47-38Z"/>
        </svg>
        <span class="vote-review-award">${escapeHtml(awardLabel)}</span>
        <span class="vote-review-pick">
          <strong>${escapeHtml(pick.name)}</strong>
          <span>${escapeHtml(team?.name || '')}</span>
        </span>
      </li>
    `;
  }).join('');
  container.querySelectorAll('.vote-review-photo').forEach((photo) => {
    photo.addEventListener('error', () => {
      photo.hidden = true;
      photo.closest('.vote-review-card')?.classList.remove('has-photo');
    }, { once: true });
  });
};

// ---- advancing ---------------------------------------------------------------
const showIdentity = () => {
  setStage('review');
  ballot.classList.add('is-hidden');
  identityForm.classList.remove('is-hidden');
  renderPickCards(el('voteRecap'), AWARDS.filter((a) => picks.has(a.id)));
  identityForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

nextBtn.addEventListener('click', () => {
  if (!nomineeTeam.value) {
    showStepError(nomineeTeamField, nomineeTeam, 'Select a team to continue.');
    return;
  }
  if (nomineePlayer.disabled) {
    showStepError(nomineeTeamField, nomineeTeam, 'No eligible players are available for this team. Select another team.');
    return;
  }
  if (!nomineePlayer.value || !picks.has(AWARDS[index].id)) {
    showStepError(nomineePlayerField, nomineePlayer, 'Select a player to continue.');
    return;
  }
  if (index < AWARDS.length - 1) {
    index += 1;
    renderAward();
    ballot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  showIdentity();
});

el('voteEditBtn').addEventListener('click', () => {
  setStage('active');
  identityForm.classList.add('is-hidden');
  ballot.classList.remove('is-hidden');
  ballot.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// The done screen is the real receipt; the email is a copy for later. So this
// never blocks the confirmation and never surfaces an error — the ballot is
// already recorded either way, and a Resend hiccup is not the voter's problem.
const sendVoteConfirmation = (voterPlayerId) => {
  fetch(`${cfg.url}/functions/v1/send-vote-confirmation`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voterPlayerId }),
  })
    .then((response) => {
      if (!response.ok) console.warn('Vote confirmation email failed:', response.status);
    })
    .catch((error) => console.warn('Vote confirmation email failed:', error));
};

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
    setStage('done');
    identityForm.classList.add('is-hidden');
    done.classList.remove('is-hidden');
    el('voteDoneTitle').textContent = `Thanks, ${name.split(' ')[0]}`;
    el('voteDoneSub').textContent = `${payload.votes} ${payload.votes === 1 ? 'vote' : 'votes'} recorded. Winners are announced on the final day.`;
    renderPickCards(el('voteSummary'), cast);
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // votes are one-per-voter, so this fires exactly once per ballot
    if (payload.player?.id) sendVoteConfirmation(payload.player.id);
  } catch (error) {
    setStatus(status, explain(error), 'error');
    submitBtn.disabled = false;
  }
});

// ---- first paint ---------------------------------------------------------------
loadNominees()
  .then(() => {
    nomineeTeam.disabled = false;
    nextBtn.disabled = false;
    ballot.removeAttribute('aria-busy');
    clearStepError();
    renderAward();
  })
  .catch((error) => {
    nomineeTeam.disabled = true;
    nomineePlayer.disabled = true;
    nextBtn.disabled = true;
    ballot.removeAttribute('aria-busy');
    showStepStatus(explain(error), 'error');
  });
