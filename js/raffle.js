/* ==========================================================================
   MVL 2026 — game-day raffle check-in
   Flow: game-day gate (Manila time) -> team + name -> one-time device
   location read -> mvl_create_raffle_checkin RPC. The SERVER decides
   eligibility (venue radius) and dedupes to one successful entry per
   person per game day; this file only reports what the server said.
   ========================================================================== */

const { teams, games } = window.MVL_DATA;
const supabase = window.MVL_SUPABASE;

// Gameville Ball Park row in mvl.venues (seeded UUID)
const VENUE_ID = '11111111-1111-4111-8111-111111111111';

const gate = document.getElementById('raffleClosed');
const form = document.getElementById('raffleForm');
const teamSelect = document.getElementById('teamSelect');
const entrantName = document.getElementById('entrantName');
const formStatus = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');
const resultPanel = document.getElementById('raffleResult');
const resultKicker = document.getElementById('resultKicker');
const resultTitle = document.getElementById('resultTitle');
const resultCopy = document.getElementById('resultCopy');
const retryBtn = document.getElementById('retryBtn');

// ---- game-day gate (Manila) --------------------------------------------------
const manilaDate = (value) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(value ? new Date(value) : new Date());

const gameDays = new Set(games.map((game) => manilaDate(game.startsAt)));
// ?preview=1 unlocks the form UI for testing; the server still refuses
// entries outside game days, so this can't be used to sneak entries in.
const previewMode = new URLSearchParams(location.search).has('preview');
const isGameDay = gameDays.has(manilaDate());

if (isGameDay || previewMode) {
  form.classList.remove('is-hidden');
} else {
  gate.classList.remove('is-hidden');
}

teams.forEach((team) => {
  const option = document.createElement('option');
  option.value = team.id;
  option.textContent = team.name;
  teamSelect.append(option);
});

// ---- helpers ------------------------------------------------------------------
const setStatus = (message, kind) => {
  formStatus.textContent = message;
  formStatus.classList.remove('is-error', 'is-success');
  if (kind) formStatus.classList.add(kind);
};

const setBusy = (busy) => {
  submitBtn.disabled = busy;
  teamSelect.disabled = busy;
  entrantName.disabled = busy;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return '';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

const getPosition = () => new Promise((resolve, reject) => {
  if (!window.isSecureContext) {
    reject(new Error('Location needs a secure (https) connection. Please open the site via its https address.'));
    return;
  }
  if (!navigator.geolocation) {
    reject(new Error("This browser can't share your location. Try opening the site in Chrome or Safari."));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, (error) => {
    if (error.code === error.PERMISSION_DENIED) {
      reject(new Error('Location permission was denied. Allow location access for this site in your browser settings, then try again.'));
    } else if (error.code === error.TIMEOUT) {
      reject(new Error("Couldn't get your location in time. Move somewhere with better signal and try again."));
    } else {
      reject(new Error("Your location is unavailable right now. Check that location services are on, then try again."));
    }
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
});

const showResult = ({ kicker, title, copy, retry }) => {
  form.classList.add('is-hidden');
  resultPanel.classList.remove('is-hidden');
  resultPanel.classList.toggle('raffle-result--retry', Boolean(retry));
  resultKicker.textContent = kicker;
  resultTitle.textContent = title;
  resultCopy.textContent = copy;
  retryBtn.classList.toggle('is-hidden', !retry);
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

retryBtn.addEventListener('click', () => {
  resultPanel.classList.add('is-hidden');
  form.classList.remove('is-hidden');
  setBusy(false);
  setStatus('');
});

// expose the renderer for local UI testing only (?preview=1)
if (previewMode) window.__raffleShowResult = showResult;

// ---- submit --------------------------------------------------------------------
const submitCheckin = async (payload) => {
  const response = await fetch(`${supabase.url}/rest/v1/rpc/mvl_create_raffle_checkin`, {
    method: 'POST',
    headers: {
      apikey: supabase.anonKey,
      Authorization: `Bearer ${supabase.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.details || response.statusText || 'Unable to check in.';
    throw new Error(message);
  }
  // RETURNS TABLE comes back as an array of rows
  return Array.isArray(body) ? body[0] : body;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  if (!supabase?.url || !supabase?.anonKey) {
    setStatus('Check-in is not configured yet. Please try again later.', 'is-error');
    return;
  }

  setBusy(true);

  let position;
  try {
    setStatus('Requesting your location…');
    position = await getPosition();
  } catch (error) {
    setBusy(false);
    setStatus(error.message, 'is-error');
    return;
  }

  try {
    setStatus('Checking you in…');
    const row = await submitCheckin({
      p_team_id: teamSelect.value,
      p_entrant_name: entrantName.value.trim(),
      p_venue_id: VENUE_ID,
      p_lat: position.coords.latitude,
      p_lng: position.coords.longitude,
      p_accuracy_m: Math.round(position.coords.accuracy ?? 0),
      p_user_agent: navigator.userAgent.slice(0, 500),
    });
    setStatus('');

    if (row?.already_entered) {
      showResult({
        kicker: 'Already In',
        title: "You're already in today's raffle",
        copy: 'One entry per game day — your name is in the draw. Come back tomorrow game day for another entry. Good luck!',
      });
    } else if (row?.inside_radius) {
      showResult({
        kicker: 'Entry Confirmed',
        title: "You're in today's raffle! 🎟",
        copy: 'Your check-in at Gameville Ball Park is recorded. Winners are drawn and claimed at the venue — keep watching the games!',
      });
    } else {
      const away = formatDistance(Number(row?.distance_m));
      showResult({
        kicker: 'Not at the Venue Yet',
        title: "You seem to be away from Gameville",
        copy: `Your device appears to be ${away ? `about ${away} ` : ''}away from Gameville Ball Park, so this entry isn't eligible. Head to the venue and check in again — same name, same team.`,
        retry: true,
      });
    }
  } catch (error) {
    setBusy(false);
    const message = String(error.message || '');
    if (message.includes('RAFFLE_CLOSED')) {
      setStatus('The raffle is only open on game days. See you at Gameville!', 'is-error');
    } else if (message.includes('duplicate key') || message.includes('one_win_per_day')) {
      showResult({
        kicker: 'Already In',
        title: "You're already in today's raffle",
        copy: 'One entry per game day — your name is in the draw. Good luck!',
      });
    } else {
      setStatus(`Something went wrong: ${message}`, 'is-error');
    }
    return;
  }

  setBusy(false);
});
