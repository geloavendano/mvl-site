const { teams } = window.MVL_DATA;
const waiverTeams = [
  ...teams,
  {
    id: 'organizer',
    name: 'Organizer',
    tag: 'Testing',
    grad: ['#D6D8E2', '#666A78'],
  },
];

const form = document.getElementById('waiverForm');
const teamSelect = document.getElementById('teamSelect');
const playerSelect = document.getElementById('playerSelect');
const playerSelectHint = document.getElementById('playerSelectHint');
const relationshipSelect = document.getElementById('relationshipSelect');
const relationshipOtherField = document.getElementById('relationshipOtherField');
const relationshipOtherInput = document.getElementById('relationshipOtherInput');
const formStatus = document.getElementById('formStatus');
const supabase = window.MVL_SUPABASE;
let playerLoadId = 0;
const playerNotFoundValue = '__player_not_found__';

waiverTeams.forEach((team) => {
  const option = document.createElement('option');
  option.value = team.id;
  option.textContent = team.name;
  teamSelect.append(option);
});

// ---- accent theming ----------------------------------------------------------
// The form's accents adopt the selected team's colour. Raw team colours are too
// dark to read as text on the navy background (e.g. #2E00A8), so the text accent
// is a lightened tint; the button keeps the fuller colour and picks black or
// white ink by luminance so it stays legible for every team.
const teamById = Object.fromEntries(waiverTeams.map((t) => [t.id, t]));
const teamSwatch = document.getElementById('teamSwatch');

const luminance = (hex) => {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const applyTeamAccent = () => {
  const team = teamById[teamSelect.value];
  const root = document.body;
  if (!team) {
    ['--accent', '--accent-2', '--accent-soft', '--accent-btn', '--accent-ink', '--waiver-bg-a', '--waiver-bg-b']
      .forEach((prop) => root.style.removeProperty(prop));
    teamSwatch?.classList.remove('is-on');
    return;
  }
  const [light, deep] = team.grad;
  root.style.setProperty('--accent', `color-mix(in srgb, ${light} 82%, #ffffff)`);
  root.style.setProperty('--accent-2', `color-mix(in srgb, ${light} 62%, #ffffff)`);
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${light} 22%, transparent)`);
  root.style.setProperty('--waiver-bg-a', light);
  root.style.setProperty('--waiver-bg-b', deep);
  // The submit button takes the team's deep colour flat, the same tone the
  // swatch reads as. It was the light end mixed 82% into white, which left
  // white ink on a near-white fill. Running the swatch's own gradient instead
  // does not work: across light -> deep no single ink clears AA on half the
  // teams, where the deep alone clears it on all eight.
  root.style.setProperty('--accent-btn', deep);
  // Pick the ink that measurably reads better rather than cutting on a fixed
  // luminance — Thurstrap's teal and Secret's orange land either side of any
  // single threshold and both came out wrong.
  root.style.setProperty('--accent-ink',
    contrast('#ffffff', deep) >= contrast('#0B0730', deep) ? '#ffffff' : '#0B0730');
  if (teamSwatch) {
    teamSwatch.style.setProperty('--team-a', light);
    teamSwatch.style.setProperty('--team-b', deep);
    teamSwatch.classList.add('is-on');
  }
};

teamSelect.addEventListener('change', applyTeamAccent);
applyTeamAccent();

const setPlayerOptions = (message, players = [], { allowMissing = false } = {}) => {
  playerSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = message;
  playerSelect.append(placeholder);

  players.forEach((player) => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = player.jerseyNumber
      ? `${player.name} · #${player.jerseyNumber}`
      : player.name;
    playerSelect.append(option);
  });

  if (allowMissing) {
    const missingOption = document.createElement('option');
    missingOption.value = playerNotFoundValue;
    missingOption.textContent = "I can't find my name";
    playerSelect.append(missingOption);
  }

  playerSelect.disabled = players.length === 0 && !allowMissing;
};

const showPlayerNotFoundHint = () => {
  playerSelectHint.textContent = 'Ask your Team Captain to add you to the official roster, then come back and submit your waiver.';
  playerSelectHint.classList.add('is-error');
};

const loadTeamPlayers = async () => {
  const requestId = ++playerLoadId;
  const teamId = teamSelect.value;
  playerSelectHint.classList.remove('is-error');

  if (!teamId) {
    setPlayerOptions('Select a team first');
    playerSelectHint.textContent = "Players are loaded from the selected team's registered roster.";
    return;
  }

  if (!supabase?.url || !supabase?.anonKey) {
    setPlayerOptions('Unable to load players');
    playerSelectHint.textContent = 'The player roster is unavailable right now.';
    playerSelectHint.classList.add('is-error');
    return;
  }

  setPlayerOptions('Loading players…');
  playerSelectHint.textContent = 'Loading the registered roster…';

  try {
    const response = await fetch(`${supabase.url}/rest/v1/rpc/mvl_get_team_players`, {
      method: 'POST',
      headers: {
        apikey: supabase.anonKey,
        Authorization: `Bearer ${supabase.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_team_id: teamId }),
    });

    if (!response.ok) throw new Error('Unable to load the player roster.');

    const players = await response.json();
    if (requestId !== playerLoadId) return;

    if (!Array.isArray(players) || players.length === 0) {
      setPlayerOptions('Select an option', [], { allowMissing: true });
      playerSelectHint.textContent = "Can't find yourself? Choose the option below for next steps.";
      return;
    }

    setPlayerOptions('Select your name', players, { allowMissing: true });
    playerSelectHint.textContent = `${players.length} registered player${players.length === 1 ? '' : 's'} found. If you can't find yourself, choose "I can't find my name."`;
  } catch (error) {
    if (requestId !== playerLoadId) return;
    setPlayerOptions('Unable to load players');
    playerSelectHint.textContent = error.message;
    playerSelectHint.classList.add('is-error');
  }
};

teamSelect.addEventListener('change', loadTeamPlayers);
playerSelect.addEventListener('change', () => {
  playerSelectHint.classList.remove('is-error');
  if (playerSelect.value === playerNotFoundValue) {
    showPlayerNotFoundHint();
  } else if (teamSelect.value && !playerSelect.disabled) {
    playerSelectHint.textContent = "Players are loaded from the selected team's registered roster.";
  }
});

const syncRelationshipOther = () => {
  const needsOther = relationshipSelect.value === 'Other';
  relationshipOtherField.classList.toggle('is-hidden', !needsOther);
  relationshipOtherInput.required = needsOther;
  if (!needsOther) relationshipOtherInput.value = '';
};

relationshipSelect.addEventListener('change', syncRelationshipOther);
syncRelationshipOther();

const submitWaiver = async (payload) => {
  if (!supabase?.url || !supabase?.anonKey) {
    throw new Error('Supabase is not configured.');
  }

  const response = await fetch(`${supabase.url}/rest/v1/rpc/mvl_submit_player_waiver`, {
    method: 'POST',
    headers: {
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Unable to submit waiver.';
    try {
      const error = await response.json();
      message = error.message || error.details || message;
    } catch (_) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
};

const sendConfirmationEmail = async (submissionId) => {
  if (!submissionId) throw new Error('Missing waiver confirmation id.');

  const response = await fetch(`${supabase.url}/functions/v1/send-waiver-confirmation`, {
    method: 'POST',
    headers: {
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submissionId }),
  });

  if (!response.ok) {
    let message = 'Unable to send confirmation email.';
    try {
      const error = await response.json();
      message = error.message || error.error || message;
    } catch (_) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus.classList.remove('is-error', 'is-success');

  if (!teamSelect.value || playerSelect.disabled || !playerSelect.value) {
    formStatus.textContent = 'Select your team and your name from the registered player list.';
    formStatus.classList.add('is-error');
    (teamSelect.value && !playerSelect.disabled ? playerSelect : teamSelect).focus();
    return;
  }

  if (playerSelect.value === playerNotFoundValue) {
    showPlayerNotFoundHint();
    formStatus.textContent = 'Ask your Team Captain to add you to the official roster before submitting your waiver.';
    formStatus.classList.add('is-error');
    playerSelect.focus();
    return;
  }

  if (!form.checkValidity()) {
    formStatus.textContent = 'Please complete all required fields and check the mobile number format.';
    formStatus.classList.add('is-error');
    form.reportValidity();
    return;
  }

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    p_team_id: formData.team_id,
    p_player_id: formData.player_id,
    p_contact_number: formData.contact_number.trim(),
    p_email: formData.email.trim(),
    p_instagram_handle: formData.instagram_handle.trim() || null,
    p_fur_parent: formData.fur_parent,
    p_emergency_contact_name: formData.emergency_contact_name.trim(),
    p_emergency_contact_number: formData.emergency_contact_number.trim(),
    p_relationship: formData.relationship,
    p_relationship_other: formData.relationship === 'Other' ? formData.relationship_other.trim() : null,
    p_waiver_acknowledged: formData.waiver_acknowledged === 'on',
    p_submitted_at: new Date().toISOString(),
    p_user_agent: navigator.userAgent,
  };

  form.querySelector('button[type="submit"]').disabled = true;
  formStatus.textContent = 'Submitting waiver...';

  try {
    const submissionId = await submitWaiver(payload);
    formStatus.textContent = 'Sending confirmation email...';
    try {
      await sendConfirmationEmail(submissionId);
    } catch (emailError) {
      console.warn('Waiver saved, but confirmation email was not sent.', emailError);
    }
    window.location.assign('/mvl/waiver-confirmation.html');
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.classList.add('is-error');
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
});
