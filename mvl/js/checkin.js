/* ==========================================================================
   Game-day check-in — two paths to the same confirmation.
     self : the player's own phone. Server checks the day, the venue radius,
            and the email on file for that team+jersey.
     qr   : the booth laptop. Staff sign in with Google; the server requires
            mvl.is_admin() because the QR payload carries no secret itself.
   Both call an RPC that resolves a real roster row, so a check-in is tied to a
   player and deduped on (player_id, day) rather than on a typed name.
   ========================================================================== */
const { teams, games, raffle } = window.MVL_DATA;
// NOT named `supabase`: supabase-js publishes a global by that name, and a
// top-level const here would claim the binding first — the library's own
// declaration then throws and window.supabase never exists.
const cfg = window.MVL_SUPABASE;

// Gameville Ball Park · Court 1 (seeded UUID) — the row that carries a location
const VENUE_ID = '11111111-1111-4111-8111-111111111111';

const el = (id) => document.getElementById(id);
const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

// Same helper as main/schedule/videos/admin.js. These are classic scripts
// sharing one global lexical scope, so the copies only coexist because no two
// of those bundles load on the same page — don't add main.js or schedule.js to
// checkin.html without collapsing this into a shared file first.
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ---- prize showcase ----------------------------------------------------------
const prizeShowcase = el('prizeShowcase');
if (prizeShowcase && raffle?.prizes?.length) {
  el('prizeHeadline').textContent = raffle.headline || 'Win big just for showing up';
  prizeShowcase.querySelector('.prize-blurb').textContent = raffle.blurb || '';
  // Each tile is a button, not a figure with a click handler: opening a viewer
  // is an action, and this way it is keyboard- and screen-reader-reachable for
  // free.
  el('prizeGrid').innerHTML = raffle.prizes.map((prize) => `
    <article class="prize-card">
      <button class="prize-media" type="button" data-poster="${escapeHtml(prize.image)}" data-poster-label="${escapeHtml(prize.name)}">
        <img src="${escapeHtml(prize.image)}" alt="${escapeHtml(prize.name)}" loading="lazy">
        <span class="prize-zoom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 1-4.9 14.32l-3.4 3.39-1.41-1.42 3.39-3.39A8 8 0 0 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm1 2v3h3v2h-3v3H9v-3H6V9h3V6h2Z"/></svg>
          Tap to zoom
        </span>
      </button>
      <div class="prize-copy">
        <h3>${escapeHtml(prize.name)}</h3>
        ${prize.drawn ? `<p class="prize-drawn">${escapeHtml(prize.drawn)}</p>` : ''}
      </div>
    </article>
  `).join('');
  prizeShowcase.classList.remove('is-hidden');
}

// ---- raffle mechanics --------------------------------------------------------
const raffleMechanics = el('raffleMechanics');
if (raffleMechanics && raffle?.mechanics?.length) {
  el('mechanicsList').innerHTML = raffle.mechanics.map((rule) => `
    <li><strong>${escapeHtml(rule.lead)}</strong> ${escapeHtml(rule.body)}</li>
  `).join('');
  el('drawDays').innerHTML = (raffle.drawDays || []).map((draw) => `
    <div class="draw-day">
      <p class="draw-day-label">${escapeHtml(draw.label)}</p>
      <p class="draw-day-when">${draw.when.map(escapeHtml).join('<br>')}</p>
    </div>
  `).join('');
  raffleMechanics.classList.remove('is-hidden');
}

// ---- poster lightbox ---------------------------------------------------------
// Fit-to-screen by default, one tap to go to natural size. When zoomed the
// stage scrolls, so panning is drag-to-scroll rather than a transform matrix —
// that keeps momentum scrolling and pinch-zoom native on touch.
const lightbox = el('prizeLightbox');
const lightboxImg = el('lightboxImg');
const lightboxStage = el('lightboxStage');
const lightboxHint = el('lightboxHint');

const setZoom = (on) => {
  lightbox.classList.toggle('is-zoomed', on);
  lightboxHint.textContent = on ? 'Drag to pan · tap to fit' : 'Tap the poster to zoom';
  if (!on) { lightboxStage.scrollTop = 0; lightboxStage.scrollLeft = 0; }
};

const openLightbox = (src, label) => {
  lightboxImg.src = src;
  lightboxImg.alt = label;
  setZoom(false);
  if (typeof lightbox.showModal === 'function') lightbox.showModal();
  else lightbox.setAttribute('open', '');
};

el('prizeGrid')?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-poster]');
  if (!trigger) return;
  openLightbox(trigger.dataset.poster, trigger.dataset.posterLabel || '');
});

lightboxImg.addEventListener('click', () => setZoom(!lightbox.classList.contains('is-zoomed')));

lightbox.addEventListener('click', (event) => {
  if (event.target.closest('[data-lightbox-close]')) { lightbox.close(); return; }
  // the ::backdrop and the stage's own padding both register on those elements,
  // never on the image — so a click there means "outside the poster"
  if (event.target === lightbox || event.target === lightboxStage) lightbox.close();
});

// Release the decoded image rather than holding both posters in memory. The
// close event is queued as a task, not fired synchronously, so a quick
// close-then-reopen would land this after the new src was set and blank the
// poster — hence the guard.
lightbox.addEventListener('close', () => {
  if (!lightbox.open) lightboxImg.removeAttribute('src');
});

// Drag-to-pan. Pointer events cover mouse, pen and single-finger touch; a
// second finger falls through to the browser's own pinch-zoom.
let panning = false;
let panFrom = { x: 0, y: 0, left: 0, top: 0 };
lightboxStage.addEventListener('pointerdown', (event) => {
  if (!lightbox.classList.contains('is-zoomed') || event.button) return;
  panning = true;
  panFrom = { x: event.clientX, y: event.clientY, left: lightboxStage.scrollLeft, top: lightboxStage.scrollTop };
});
lightboxStage.addEventListener('pointermove', (event) => {
  if (!panning) return;
  lightboxStage.scrollLeft = panFrom.left - (event.clientX - panFrom.x);
  lightboxStage.scrollTop = panFrom.top - (event.clientY - panFrom.y);
});
const endPan = () => { panning = false; };
lightboxStage.addEventListener('pointerup', endPan);
lightboxStage.addEventListener('pointercancel', endPan);
lightboxStage.addEventListener('pointerleave', endPan);

// ---- game-day gate (Manila) --------------------------------------------------
// The client gate only decides what to show. The server re-checks the day on
// every call, so this can never let a real check-in through on a closed day.
const manilaDate = (value) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value ? new Date(value) : new Date());

const openDays = new Set([
  ...games.map((game) => manilaDate(game.startsAt)),
  ...(raffle?.openDates || []),
]);
const previewMode = new URLSearchParams(location.search).has('preview');
const isOpen = previewMode || openDays.has(manilaDate());

const modeSheet = el('modeSheet');
const openModes = el('openModes');
const selfForm = el('selfForm');
const qrPanel = el('qrPanel');
const done = el('checkinDone');

if (!isOpen) {
  el('raffleClosed').classList.remove('is-hidden');
  openModes?.remove();
}

// ---- shared helpers ------------------------------------------------------------
const setStatus = (node, message, kind) => {
  node.textContent = message || '';
  node.classList.toggle('is-error', kind === 'error');
  node.classList.toggle('is-success', kind === 'success');
};

const show = (node) => node.classList.remove('is-hidden');
const hide = (node) => node.classList.add('is-hidden');

const playerPhotoUrl = (payload) => {
  const { photo_url: url, photo_path: path } = payload.player;
  if (url) return url;
  if (!path) return '';
  const clean = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${cfg.url}/storage/v1/object/public/mvl-player-photos/${clean}`;
};

const cssUrl = (value) => `url(${JSON.stringify(value)})`;

// ---- fit: the team name to the card's rail ---------------------------------
// Mirrors fitTeamNames() in main.js. The rail is only as tall as the card, so
// a long name set vertically can outrun it; scale any name that overruns down
// to fit and leave the rest at the size the stylesheet picked.
const fitTeamName = () => {
  const name = el('checkinTeam');
  const rail = name?.parentElement;
  if (!name || !rail) return;
  name.style.fontSize = '';
  const railStyle = getComputedStyle(rail);
  const room = rail.clientHeight
    - parseFloat(railStyle.paddingTop)
    - parseFloat(railStyle.paddingBottom);
  const needed = name.getBoundingClientRect().height;
  if (!room || !needed || needed <= room) return;
  const base = parseFloat(getComputedStyle(name).fontSize);
  // a hair under the exact ratio so rounding never leaves a clipped glyph
  name.style.fontSize = `${Math.max(9, base * (room / needed) * 0.97)}px`;
};

// STRRETCH loads async and is far narrower than the fallback, so a measurement
// taken before it lands would be against the wrong metrics
if (document.fonts?.ready) document.fonts.ready.then(fitTeamName);

let fitTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(fitTeamName, 120);
});

const setTeamTheme = (node, team) => {
  if (!node) return;
  if (!team) {
    node.style.removeProperty('--team-a');
    node.style.removeProperty('--team-b');
    node.style.removeProperty('--team-art');
    node.classList.remove('has-team-art');
    return;
  }

  node.style.setProperty('--team-a', team.grad[0]);
  node.style.setProperty('--team-b', team.grad[1]);
  if (team.bg) node.style.setProperty('--team-art', cssUrl(team.bg));
  else node.style.removeProperty('--team-art');
  node.classList.toggle('has-team-art', Boolean(team.bg));
};

const rpc = async (fn, body, token) => {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token || cfg.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
};

// The server raises these; turn them into something a person can act on.
const friendlyError = (message) => {
  // the server appends the offending token so the booth can read it back
  const unknownTeam = /^UNKNOWN_TEAM_CODE:(.*)$/.exec(message || '');
  if (unknownTeam) {
    return `"${unknownTeam[1].trim()}" isn't one of our team codes. Check the QR, or use the registration booth's list.`;
  }
  if (message.startsWith('OUTSIDE_VENUE')) {
    const metres = Number(message.split(':')[1] || 0);
    const away = metres >= 1000 ? `${(metres / 1000).toFixed(1)}km` : `${Math.round(metres)}m`;
    return `You look about ${away} from Gameville Ball Park. Check in once you're at the venue.`;
  }
  return {
    CHECKIN_CLOSED: "Check-in isn't open today. It runs on game days only.",
    PLAYER_NOT_FOUND: "We couldn't find that jersey number on that team. Double-check both, or visit the registration booth.",
    EMAIL_MISMATCH: "That email doesn't match the one on your registration. Use the address you registered with, or visit the booth.",
    NO_EMAIL_ON_FILE: 'There is no email on your registration, so self check-in is unavailable. Please check in at the registration booth.',
    NOT_AUTHORISED: 'This Google account is not an MVL administrator.',
    BAD_CODE: "That code isn't in the expected format. A player QR reads like THT-23 — team code, dash, jersey number.",
    VENUE_NOT_FOUND: 'Venue is not configured. Please check in at the booth.',
    VENUE_LOCATION_MISSING: 'Venue location is not configured. Please check in at the booth.',
  }[message] || message;
};

// ---- verifying stage ----------------------------------------------------------
// A booth scan resolves in well under a second, so the confirmation used to
// appear as though nothing had happened in between. This holds a "checking"
// screen over the gap. It is a FLOOR, not a delay: if the request already took
// longer than the floor, nothing extra is added — a bad connection at the venue
// never gets padded on top.
const PENDING_FLOOR_MS = 950;
const pending = el('checkinPending');
let pendingSince = 0;

const beginPending = (team, who) => {
  // carry the team colour in, so the swap to the confirmation does not change
  // hue mid-moment
  if (team?.grad) {
    pending.style.setProperty('--team-a', team.grad[0]);
    pending.style.setProperty('--team-b', team.grad[1]);
  } else {
    pending.style.removeProperty('--team-a');
    pending.style.removeProperty('--team-b');
  }
  el('pendingWho').textContent = who || '';
  // reuse the confirmation's takeover so the swap happens on one surface
  document.body.classList.add('checkin-complete');
  hide(done);
  show(pending);
  pendingSince = performance.now();
};

const settlePending = async () => {
  if (!pendingSince) return;
  const left = PENDING_FLOOR_MS - (performance.now() - pendingSince);
  pendingSince = 0;
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
  hide(pending);
};

// a failed check-in has to put the page back the way it was
const cancelPending = () => {
  pendingSince = 0;
  hide(pending);
  document.body.classList.remove('checkin-complete');
};

// ---- confirmation --------------------------------------------------------------
const CHEERS = [
  'Go get it out there.',
  'Leave it all on the court.',
  'Play loose, play loud.',
  'Make it count today.',
];

// The screen is the real receipt; the email is a bonus. So this never blocks
// the confirmation and never surfaces an error — at the booth there is a queue
// behind the player, and a Resend hiccup is not their problem.
const sendConfirmationEmail = (checkinId) => {
  fetch(`${cfg.url}/functions/v1/send-checkin-confirmation`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checkinId }),
  })
    .then((response) => {
      if (!response.ok) console.warn('Check-in confirmation email failed:', response.status);
    })
    .catch((error) => console.warn('Check-in confirmation email failed:', error));
};

const showConfirmation = (payload) => {
  const team = teamById[payload.team.id];
  const card = el('checkinCard');
  // Colours and art come from league-data.js, not the row: the client is the
  // source of truth for the 2026 palette.
  setTeamTheme(done, team);
  setTeamTheme(card, team);

  const img = el('checkinPhotoImg');
  const src = playerPhotoUrl(payload);
  const photo = el('checkinPhoto');
  photo.classList.toggle('has-photo', Boolean(src));
  if (src) {
    img.src = src;
    img.hidden = false;
    // a broken or missing file falls back to the silhouette rather than an icon
    img.onerror = () => { img.hidden = true; photo.classList.remove('has-photo'); };
  } else {
    img.hidden = true;
    img.removeAttribute('src');
  }

  const player = payload.player;
  const full = [player.display_name, player.surname].filter(Boolean).join(' ');
  el('checkinTeam').textContent = payload.team.name || '';
  fitTeamName();
  el('checkinName').textContent = full;
  el('checkinJersey').textContent = player.jersey_number ? `Jersey ${player.jersey_number}` : '';

  if (payload.already_checked_in) {
    const at = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
    }).format(new Date(payload.checked_in_at));
    el('checkinKicker').textContent = 'Already checked in';
    el('checkinMessage').textContent = `You're in the draw for today — checked in at ${at}. No need to do it again.`;
  } else {
    el('checkinKicker').textContent = "You're checked in!";
    el('checkinMessage').textContent =
      `You're in today's raffle draw. ${CHEERS[Math.floor(Math.random() * CHEERS.length)]} Best of luck!`;
  }

  hide(selfForm); hide(qrPanel);
  if (modeSheet.open) modeSheet.close();
  // the takeover hides everything else, so lock the page behind it
  document.body.classList.add('checkin-complete');
  show(done);
  window.scrollTo(0, 0);

  // Only on a fresh entry: a repeat check-in already got its email today, and
  // the RPC hands back the original row either way.
  if (!payload.already_checked_in && payload.checkin_id) {
    sendConfirmationEmail(payload.checkin_id);
  }
};

el('checkinAgainBtn').addEventListener('click', () => {
  hide(done);
  document.body.classList.remove('checkin-complete');
  // staff stay on the scanner; a player is offered the choice again
  if (qrSignedIn) { showView('qr'); focusScanner(); } else { showView(null); openSheet(); }
});

// ---- mode chooser (modal) ---------------------------------------------------
const openSheet = () => {
  if (typeof modeSheet.showModal === 'function') modeSheet.showModal();
  else modeSheet.setAttribute('open', '');
};

openModes?.addEventListener('click', openSheet);

// ---- view routing -----------------------------------------------------------
// Exactly one flow is on screen at a time, and each is a real URL. That gives
// the browser Back button something to return to, lets staff bookmark
// ?mode=qr, and gives the Google redirect a view to land on.
const views = { self: selfForm, qr: qrPanel };

const showView = (name, push = true) => {
  hide(selfForm);
  hide(qrPanel);
  if (modeSheet.open) modeSheet.close();

  const view = views[name];
  if (view) {
    show(view);
    // the scanner input lives behind sign-in, so only the form takes focus here
    if (name === 'self') el('teamSelect').focus();
    view.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!push) return;
  history.pushState({ view: name || '' }, '', view ? `${location.pathname}?mode=${name}` : location.pathname);
};

const urlMode = () => new URLSearchParams(location.search).get('mode');

window.addEventListener('popstate', () => showView(urlMode(), false));

document.querySelectorAll('[data-back]').forEach((button) => {
  button.addEventListener('click', () => { showView(null); openSheet(); });
});

modeSheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-sheet-close]')) { modeSheet.close(); return; }
  // a click on the ::backdrop registers on the dialog itself
  if (event.target === modeSheet) { modeSheet.close(); return; }

  const button = event.target.closest('[data-mode]');
  if (!button) return;
  showView(button.dataset.mode);
});

// ---- self check-in ---------------------------------------------------------------
const teamSelect = el('teamSelect');
const teamSwatch = el('teamSwatch');
teamSelect.innerHTML = '<option value="">Select your team</option>' +
  teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join('');

// Same treatment as the waiver: picking a team recolours the page's accents,
// so the form already looks like the team before the confirmation appears.
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
    ['--accent', '--accent-2', '--accent-soft', '--accent-btn', '--accent-ink']
      .forEach((prop) => root.style.removeProperty(prop));
    teamSwatch?.classList.remove('is-on');
    return;
  }
  const [light, deep] = team.grad;
  root.style.setProperty('--accent', `color-mix(in srgb, ${light} 82%, #ffffff)`);
  root.style.setProperty('--accent-2', `color-mix(in srgb, ${light} 62%, #ffffff)`);
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${light} 22%, transparent)`);
  // flat deep tone on the button, and whichever ink measurably reads better on
  // it — the same reasoning as the waiver's submit button
  root.style.setProperty('--accent-btn', deep);
  root.style.setProperty('--accent-ink',
    contrast('#ffffff', deep) >= contrast('#0B0730', deep) ? '#ffffff' : '#0B0730');
  if (teamSwatch) {
    teamSwatch.style.setProperty('--team-a', light);
    teamSwatch.style.setProperty('--team-b', deep);
    teamSwatch.classList.add('is-on');
  }
};

teamSelect.addEventListener('change', applyTeamAccent);

const getPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('This device cannot share its location. Please check in at the booth.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, (error) => {
    reject(new Error(error.code === error.PERMISSION_DENIED
      ? 'Location permission is off, so we cannot confirm you are at the venue. Turn it on, or check in at the booth.'
      : 'We could not read your location. Move somewhere with a clearer signal and try again.'));
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
});

const formStatus = el('formStatus');
const submitBtn = el('submitBtn');

selfForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const teamId = teamSelect.value;
  const jersey = el('jerseyNumber').value.trim();
  const email = el('checkinEmail').value.trim();

  if (!teamId || !jersey || !email) {
    setStatus(formStatus, 'Fill in your team, jersey number and email.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus(formStatus, 'Checking your location…');
  try {
    const position = await getPosition();
    setStatus(formStatus, 'Checking you in…');
    const chosen = teamById[teamId];
    beginPending(chosen, chosen ? `${chosen.name} \u00b7 #${jersey}` : `#${jersey}`);
    const payload = await rpc('mvl_self_checkin', {
      p_team_id: teamId,
      p_jersey_number: jersey,
      p_email: email,
      p_venue_id: VENUE_ID,
      p_lat: position.coords.latitude,
      p_lng: position.coords.longitude,
      p_accuracy_m: position.coords.accuracy ?? null,
      p_user_agent: navigator.userAgent,
    });
    setStatus(formStatus, '');
    await settlePending();
    showConfirmation(payload);
  } catch (error) {
    cancelPending();
    setStatus(formStatus, friendlyError(error.message), 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- QR booth -------------------------------------------------------------------
// supabase-js is only needed to sign a staff member in, so it is fetched on
// demand rather than shipped to every visitor who opens this page.
let authClient = null;
let qrSignedIn = false;
const qrAuthStatus = el('qrAuthStatus');
const qrStatus = el('qrStatus');
const qrInput = el('qrInput');

const focusScanner = () => setTimeout(() => qrInput.focus(), 50);

const loadAuthClient = () => new Promise((resolve, reject) => {
  if (authClient) { resolve(authClient); return; }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    authClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    resolve(authClient);
  };
  script.onerror = () => reject(new Error('Could not load sign-in. Check the connection and try again.'));
  document.head.appendChild(script);
});

const enterScanner = (session) => {
  qrSignedIn = true;
  hide(el('qrSignIn'));
  show(el('qrScanner'));
  el('qrWho').textContent = `Signed in as ${session.user?.email || 'staff'}. Scan a player's QR code to check them in.`;
  focusScanner();
};

el('qrSignInBtn').addEventListener('click', async () => {
  setStatus(qrAuthStatus, 'Loading sign-in…');
  try {
    const client = await loadAuthClient();
    setStatus(qrAuthStatus, 'Redirecting to Google…');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/mvl/checkin` },
    });
    if (error) throw error;
  } catch (error) {
    setStatus(qrAuthStatus, error.message, 'error');
  }
});

el('qrSignOutBtn').addEventListener('click', async () => {
  if (authClient) await authClient.auth.signOut();
  qrSignedIn = false;
  hide(el('qrScanner'));
  show(el('qrSignIn'));
  setStatus(qrAuthStatus, '');
});

const submitCode = async (code) => {
  if (!code) return;
  // Name the team and jersey back while the request is in flight, so staff can
  // catch a wrong badge mid-queue. Set here rather than at each call site: this
  // used to overwrite a more specific message the caller had just set.
  const scan = parseScan(code);
  setStatus(qrStatus, scan.team
    ? `Checking in ${scan.team.name} #${scan.jersey}\u2026`
    : 'Checking in\u2026');
  beginPending(scan.team, scan.team ? `${scan.team.name} \u00b7 #${scan.jersey}` : code);
  try {
    const { data } = await authClient.auth.getSession();
    const payload = await rpc('mvl_qr_checkin',
      { p_code: code, p_user_agent: navigator.userAgent },
      data?.session?.access_token);
    setStatus(qrStatus, '');
    await settlePending();
    showConfirmation(payload);
  } catch (error) {
    cancelPending();
    setStatus(qrStatus, friendlyError(error.message), 'error');
    focusScanner();
  }
};

// Printed QR payloads read <TEAM CODE>-<JERSEY>, e.g. THT-23. Split on the
// LAST separator so a raw team id containing a hyphen ('metarice-x-8') and the
// original underscore payload ('gizmo_31') both still parse — same rule the
// server uses, kept here only to fail an obvious mis-scan without a round trip.
const teamByCode = Object.fromEntries(
  teams.filter((team) => team.code).map((team) => [team.code.toUpperCase(), team])
);

const parseScan = (raw) => {
  const parts = /^(.*)[-_]([^-_]+)$/.exec(raw.trim());
  if (!parts) return { error: 'BAD_CODE' };
  const token = parts[1].trim();
  const team = teamByCode[token.toUpperCase()] || teamById[token.toLowerCase()];
  // an unrecognised token is still sent on: the server's team list is the
  // authority, and this copy could be stale
  return { team, token, jersey: parts[2].trim() };
};

// ---- camera fallback ---------------------------------------------------------
// The booth's reader is the fast path; this covers it being missing, unpaired
// or jammed. Two decoders because coverage is split: BarcodeDetector is native
// in Chrome and Android but absent from Safari and Firefox, so those lazy-load
// jsQR — same on-demand pattern as supabase-js, nothing shipped to a visitor
// who never opens the camera.
const camSheet = el('camSheet');
const camVideo = el('camVideo');
const camStatus = el('camStatus');
let camStream = null;
let camLoop = 0;
let jsqrLoader = null;

const loadJsQr = () => {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  jsqrLoader = jsqrLoader || new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => resolve(window.jsQR);
    script.onerror = () => reject(new Error('Could not load the camera decoder.'));
    document.head.appendChild(script);
  });
  return jsqrLoader;
};

const stopCamera = () => {
  cancelAnimationFrame(camLoop);
  camLoop = 0;
  // tracks must be stopped explicitly or the camera light stays on
  camStream?.getTracks().forEach((track) => track.stop());
  camStream = null;
  camVideo.srcObject = null;
};

const closeCamera = () => {
  stopCamera();
  if (camSheet.open) camSheet.close();
};

// Fed whatever the decoder found; the keyboard path runs the same checks.
const handleScan = (raw) => {
  const scan = parseScan(raw);
  if (scan.error) {
    setStatus(camStatus, friendlyError(scan.error), 'error');
    return false; // keep looking — a half-read frame should not close the sheet
  }
  closeCamera();
  qrInput.value = '';
  submitCode(raw.trim());
  return true;
};

const runDetectorLoop = (detect) => {
  const tick = async () => {
    if (!camStream) return;
    try {
      const found = await detect();
      if (found && handleScan(found)) return;
    } catch { /* a frame that will not decode is normal; try the next one */ }
    camLoop = requestAnimationFrame(tick);
  };
  camLoop = requestAnimationFrame(tick);
};

const startDecoding = async () => {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        runDetectorLoop(async () => (await detector.detect(camVideo))[0]?.rawValue);
        return;
      }
    } catch { /* fall through to jsQR */ }
  }
  const jsQR = await loadJsQr();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  runDetectorLoop(() => {
    if (!camVideo.videoWidth) return null;
    canvas.width = camVideo.videoWidth;
    canvas.height = camVideo.videoHeight;
    ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(px.data, px.width, px.height)?.data || null;
  });
};

const cameraError = (error) => {
  if (!window.isSecureContext) return 'The camera needs a secure (https) connection.';
  const name = error?.name || '';
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow it in the browser\u2019s site settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device.';
  if (name === 'NotReadableError') return 'The camera is already in use by another app.';
  return error?.message || 'Could not start the camera.';
};

el('qrCamBtn')?.addEventListener('click', async () => {
  setStatus(camStatus, 'Starting the camera\u2026');
  if (typeof camSheet.showModal === 'function') camSheet.showModal();
  else camSheet.setAttribute('open', '');
  try {
    // the rear camera on a phone; a laptop just gets its only one
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    camVideo.srcObject = camStream;
    await camVideo.play();
    setStatus(camStatus, '');
    await startDecoding();
  } catch (error) {
    stopCamera();
    setStatus(camStatus, cameraError(error), 'error');
  }
});

camSheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-cam-close]') || event.target === camSheet) closeCamera();
});
// Esc closes a <dialog> on its own, but the stream would keep running
camSheet.addEventListener('close', stopCamera);

// A booth scanner behaves as a keyboard: it types the payload then presses
// Enter. That covers any USB or Bluetooth reader with no camera permission and
// no decoding library, and typing a code by hand works the same way.
qrInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const code = qrInput.value.trim();
  qrInput.value = '';
  if (!code) return;

  const scan = parseScan(code);
  if (scan.error) {
    setStatus(qrStatus, friendlyError(scan.error), 'error');
    focusScanner();
    return;
  }
  submitCode(code);
});

// ---- first paint --------------------------------------------------------------
// Returning from the Google redirect lands here carrying the grant, so go
// straight to the scanner rather than making staff pick a mode again.
if (location.hash.includes('access_token') || location.search.includes('code=')) {
  showView('qr', false);
  setStatus(qrAuthStatus, 'Signing in…');
  loadAuthClient()
    .then((client) => client.auth.getSession())
    .then(({ data }) => {
      if (data?.session) {
        setStatus(qrAuthStatus, '');
        enterScanner(data.session);
      } else {
        setStatus(qrAuthStatus, 'Sign-in did not complete. Try again.', 'error');
      }
      // drop the grant from the URL either way, but keep the view
      history.replaceState(null, '', `${location.pathname}?mode=qr`);
    })
    .catch((error) => setStatus(qrAuthStatus, error.message, 'error'));
} else if (isOpen) {
  // an already-signed-in staff member reloading ?mode=qr goes back to the scanner
  showView(urlMode(), false);
  if (urlMode() === 'qr') {
    loadAuthClient()
      .then((client) => client.auth.getSession())
      .then(({ data }) => { if (data?.session) enterScanner(data.session); })
      .catch(() => { /* not signed in: the sign-in button is already showing */ });
  }
}
