const cfg = window.MVL_SUPABASE;
const authClient = window.supabase.createClient(cfg.url, cfg.anonKey);
let session = null;
let data;
let activeAdminDay = 1;
let readinessRequest = 0;
let emergencyRequest = 0;
let readinessPlayers = new Map();
const readinessTeamFilter = document.getElementById('readinessTeamFilter');
const readinessDayFilter = document.getElementById('readinessDayFilter');
const readinessTeamSummary = document.getElementById('readinessTeamSummary');
const readinessSummary = document.getElementById('readinessSummary');
const readinessTable = document.getElementById('readinessTable');
const unmatchedCheckins = document.getElementById('unmatchedCheckins');
const emergencyContactDialog = document.getElementById('emergencyContactDialog');
const emergencyDialogTitle = document.getElementById('emergencyDialogTitle');
const emergencyContactLoading = document.getElementById('emergencyContactLoading');
const emergencyContactDetails = document.getElementById('emergencyContactDetails');
const emergencyContactName = document.getElementById('emergencyContactName');
const emergencyContactRelationship = document.getElementById('emergencyContactRelationship');
const emergencyContactNumber = document.getElementById('emergencyContactNumber');
const emergencyContactError = document.getElementById('emergencyContactError');
const emergencyCallLink = document.getElementById('emergencyCallLink');
const scoreboardCreateForm = document.getElementById('scoreboardCreateForm');
const scoreboardList = document.getElementById('scoreboardList');
const newScoreboardBtn = document.getElementById('newScoreboardBtn');
const raffleExportForm = document.getElementById('raffleExportForm');
const raffleBlacklistForm = document.getElementById('raffleBlacklistForm');
const raffleBlacklistTeam = document.getElementById('raffleBlacklistTeam');
const raffleBlacklistPlayer = document.getElementById('raffleBlacklistPlayer');
const raffleBlacklistList = document.getElementById('raffleBlacklistList');
const raffleDrawBtn = document.getElementById('raffleDrawBtn');
const raffleDrawDialog = document.getElementById('raffleDrawDialog');
const raffleDrawTitle = document.getElementById('raffleDrawTitle');
const raffleDrawingView = document.getElementById('raffleDrawingView');
const raffleWinnerView = document.getElementById('raffleWinnerView');
const raffleDrawCount = document.getElementById('raffleDrawCount');
const raffleDrawPool = document.getElementById('raffleDrawPool');
const raffleDrawCountdown = document.getElementById('raffleDrawCountdown');
const raffleWinnerPhoto = document.getElementById('raffleWinnerPhoto');
const raffleWinnerPhotoFallback = document.getElementById('raffleWinnerPhotoFallback');
const raffleWinnerName = document.getElementById('raffleWinnerName');
const raffleWinnerMeta = document.getElementById('raffleWinnerMeta');
const raffleWinnerFurparent = document.getElementById('raffleWinnerFurparent');
const raffleWinnerForm = document.getElementById('raffleWinnerForm');
let rafflePlayerRequest = 0;
let raffleDrawToken = 0;
let raffleSpinFrame = null;
let currentRaffleWinner = null;
const adminTabs = [...document.querySelectorAll('[data-admin-tab]')];
const adminTabPanels = [...document.querySelectorAll('[data-admin-panel]')];
const adminTabNames = new Set(adminTabs.map((tab) => tab.dataset.adminTab));
const streamSetupGuide = document.getElementById('streamSetupGuide');
const streamCameraTabs = [...streamSetupGuide.querySelectorAll('[data-stream-camera-tab]')];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));
const teams = Object.fromEntries(window.MVL_DATA.teams.map((t) => [t.id, t]));
const adminTeamColor = (teamId) => {
  const source = teams[teamId]?.grad?.[1];
  if (!/^#[0-9a-f]{6}$/i.test(source || '')) return '#475467';
  const base = [29, 36, 51];
  const rgb = source.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
  return `#${rgb.map((value, index) => Math.round(value * .68 + base[index] * .32).toString(16).padStart(2, '0')).join('')}`;
};
const teamNameMarkup = (teamId, name, className = '') => `<span class="admin-team-name ${className}" style="--team-color:${adminTeamColor(teamId)}">${escapeHtml(name)}</span>`;
const gameTeamName = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  return label || teams[id]?.name || 'TBD';
};
const gameTeamMarkup = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  const name = gameTeamName(game, side);
  return label ? escapeHtml(name) : teamNameMarkup(id, name);
};
const status = (el, text, type = '') => { el.textContent = text; el.className = `form-status ${type ? `is-${type}` : ''}`; };
const adminTabFromHash = () => {
  const requested = window.location.hash.slice(1);
  return adminTabNames.has(requested) ? requested : 'registrations';
};
const activateAdminTab = (name, { updateUrl = false, focus = false } = {}) => {
  const activeName = adminTabNames.has(name) ? name : 'registrations';
  adminTabs.forEach((tab) => {
    const isActive = tab.dataset.adminTab === activeName;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) tab.focus();
  });
  adminTabPanels.forEach((panel) => {
    const isActive = panel.dataset.adminPanel === activeName;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
  if (updateUrl && window.location.hash !== `#${activeName}`) {
    window.history.pushState(null, '', `#${activeName}`);
  }
};
const activateStreamCamera = (camera, { focus = false } = {}) => {
  streamSetupGuide.dataset.streamCamera = camera;
  streamCameraTabs.forEach((tab) => {
    const isActive = tab.dataset.streamCameraTab === camera;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) tab.focus();
  });
  streamSetupGuide.querySelectorAll('[data-stream-camera-content]').forEach((content) => {
    content.hidden = content.dataset.streamCameraContent !== camera;
  });
};
const playerPhotoUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${cfg.url}/storage/v1/object/public/mvl-player-photos/${path}`;
};
const playerPreview = (player) => {
  if (!player) return '<div class="admin-player-preview is-empty" data-player-preview>No player selected</div>';
  const photo = playerPhotoUrl(player.photoPath);
  const teamName = teams[player.team]?.name || player.team;
  return `<div class="admin-player-preview" data-player-preview>
    ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<div class="admin-player-photo-placeholder">No photo</div>'}
    <div><strong>${escapeHtml(player.name)}</strong><span>#${escapeHtml(player.jerseyNumber || '—')} · ${teamNameMarkup(player.team, teamName, 'admin-player-team')}</span></div>
  </div>`;
};
const call = async (path, body, token = session?.access_token) => {
  const res = await fetch(`${cfg.url}${path}`, { method: 'POST', cache: 'no-store', headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token || cfg.anonKey}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error_description || 'Request failed');
  return json;
};
const rpc = (name, body) => call(`/rest/v1/rpc/${name}`, body);
const scoreboardUrls = (board) => ({
  obs: `${window.location.origin}/mvl/scoreboard?board=${encodeURIComponent(board.id)}`,
  control: `${window.location.origin}/mvl/scoreboard-control?board=${encodeURIComponent(board.id)}&key=${encodeURIComponent(board.controlToken)}`,
});
const copyText = async (value) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  document.execCommand('copy');
  input.remove();
};
const renderScoreboards = (boards) => {
  if (!boards.length) {
    scoreboardList.innerHTML = '<p class="admin-scoreboard-empty">No live scoreboards yet. Create one for each court or match you need to run.</p>';
    return;
  }
  scoreboardList.innerHTML = boards.map((board) => {
    const urls = scoreboardUrls(board);
    return `<article class="admin-scoreboard-card" data-scoreboard-id="${escapeHtml(board.id)}">
      <div class="admin-scoreboard-matchup">
        <div><strong>${escapeHtml(board.name)}</strong><span>${board.game ? `Game: ${escapeHtml(board.game.id)} · Set ${board.currentSet} · ` : ''}Updated ${escapeHtml(new Date(board.updatedAt).toLocaleString('en-PH'))}</span></div>
        <div class="admin-scoreboard-score"><span style="--team-color:${escapeHtml(board.leftTeam.colorB)}">${escapeHtml(board.leftTeam.name)} <b>${board.leftScore}</b></span><i>–</i><span style="--team-color:${escapeHtml(board.rightTeam.colorB)}"><b>${board.rightScore}</b> ${escapeHtml(board.rightTeam.name)}</span></div>
      </div>
      <div class="admin-scoreboard-actions">
        <a class="cta cta--primary" href="${escapeHtml(urls.control)}" target="_blank" rel="noopener">Manage</a>
        <button class="cta cta--secondary" type="button" data-copy-url="${escapeHtml(urls.obs)}">Copy OBS link</button>
        <button class="cta cta--secondary" type="button" data-copy-url="${escapeHtml(urls.control)}">Copy control link</button>
      </div>
      <p class="form-status"></p>
    </article>`;
  }).join('');
};
const loadScoreboards = async () => {
  try {
    const boards = await rpc('mvl_admin_get_scoreboards');
    renderScoreboards(boards || []);
  } catch (error) {
    scoreboardList.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
  }
};
const populateScoreboardTeams = () => {
  const options = window.MVL_DATA.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
  scoreboardCreateForm.elements.leftTeam.innerHTML = options;
  scoreboardCreateForm.elements.rightTeam.innerHTML = options;
  scoreboardCreateForm.elements.rightTeam.selectedIndex = Math.min(1, window.MVL_DATA.teams.length - 1);
};
const instagramDisplay = (value) => {
  const handle = String(value || '').trim().replace(/^@/, '');
  return handle ? `@${handle}` : '';
};
const telephoneHref = (value) => {
  const compact = String(value || '').replace(/[^+\d]/g, '');
  const normalized = compact.startsWith('+')
    ? `+${compact.slice(1).replace(/\+/g, '')}`
    : compact.replace(/\+/g, '');
  return /\d/.test(normalized) ? `tel:${normalized}` : '';
};
const clearEmergencyContact = () => {
  emergencyRequest += 1;
  emergencyDialogTitle.textContent = 'Player';
  emergencyContactName.textContent = '';
  emergencyContactRelationship.textContent = '';
  emergencyContactNumber.textContent = '';
  emergencyContactError.textContent = '';
  emergencyCallLink.removeAttribute('href');
  emergencyContactLoading.classList.remove('is-hidden');
  emergencyContactDetails.classList.add('is-hidden');
  emergencyContactError.classList.add('is-hidden');
  emergencyCallLink.classList.add('is-hidden');
};
const openEmergencyContact = async (player) => {
  clearEmergencyContact();
  const request = emergencyRequest;
  emergencyDialogTitle.textContent = player.name;
  emergencyContactDialog.showModal();
  try {
    const contact = await rpc('mvl_admin_get_player_emergency_contact', {
      p_player_id: player.id,
    });
    if (request !== emergencyRequest || !emergencyContactDialog.open) return;
    const callHref = telephoneHref(contact.phoneNumber);
    emergencyContactName.textContent = contact.contactName || 'Not provided';
    emergencyContactRelationship.textContent = contact.relationship || 'Not provided';
    emergencyContactNumber.textContent = contact.phoneNumber || 'Not provided';
    emergencyContactLoading.classList.add('is-hidden');
    emergencyContactDetails.classList.remove('is-hidden');
    if (callHref) {
      emergencyCallLink.href = callHref;
      emergencyCallLink.classList.remove('is-hidden');
    }
  } catch (error) {
    if (request !== emergencyRequest || !emergencyContactDialog.open) return;
    emergencyContactLoading.classList.add('is-hidden');
    emergencyContactError.textContent = error.message;
    emergencyContactError.classList.remove('is-hidden');
  }
};
const youtubeId = (value) => {
  const clean = value.trim();
  if (!clean) return null;
  try {
    const url = new URL(clean);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null;
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/') || url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    return url.searchParams.get('v') || clean;
  } catch { return clean; }
};
const validYouTubeId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '');
const gameVideos = (game) => {
  if (Array.isArray(game.videos) && game.videos.length) return game.videos;
  if (validYouTubeId(game.youtubeId)) {
    return [{
      youtubeId: game.youtubeId,
      label: game.videoLabel || 'Full Game',
      duration: game.duration || '',
    }];
  }
  return [];
};
const videoRow = (video = {}) => `
  <div class="admin-video-row" data-video-row>
    <label class="field">
      <span>Label</span>
      <input data-video-label type="text" maxlength="80" value="${escapeHtml(video.label ?? 'Full Game')}" placeholder="Set 1">
    </label>
    <label class="field">
      <span>YouTube URL</span>
      <input data-video-url type="url" value="${video.youtubeId ? `https://www.youtube.com/watch?v=${escapeHtml(video.youtubeId)}` : ''}" placeholder="https://youtube.com/watch?v=...">
    </label>
    <button type="button" class="admin-link admin-video-remove" data-remove-video>Remove</button>
  </div>`;
const formatAdminDay = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', weekday: 'short',
}).format(new Date(iso));
const formatReadinessDay = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', weekday: 'short',
}).format(new Date(`${iso}T12:00:00+08:00`));
const formatAdminDate = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', weekday: 'short',
}).format(new Date(iso));
const formatAdminTime = (iso) => iso ? new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso)) : '';
const manilaDateInput = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const furparentLabel = (value) => ({
  dog: 'Dog', cat: 'Cat', dog_cat: 'Dog & cat', other_pet: 'Other pet', not_now: 'Not a furparent',
}[value] || 'Not provided');
const csvCell = (value) => {
  let clean = String(value ?? '');
  if (/^[=+\-@]/.test(clean)) clean = `'${clean}`;
  return `"${clean.replace(/"/g, '""')}"`;
};
const downloadRaffleCsv = (payload) => {
  const rows = [
    ['Check-in date', 'Check-in time', 'Team', 'Player', 'Jersey number', 'Furparent type'],
    ...(payload.entries || []).map((entry) => [
      entry.checkinDay,
      formatAdminTime(entry.checkedInAt),
      entry.teamName,
      entry.playerName,
      entry.jerseyNumber || '',
      furparentLabel(entry.furparentType),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  const suffix = payload.furparentOnly ? '-furparents' : '';
  link.href = url;
  link.download = `mvl-raffle-entries-${payload.startDate}-${payload.endDate}${suffix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
const populateRaffleTeams = () => {
  raffleBlacklistTeam.innerHTML = window.MVL_DATA.teams.map((team) => (
    `<option value="${escapeHtml(team.id)}" style="color:${adminTeamColor(team.id)}">${escapeHtml(team.name)}</option>`
  )).join('');
};
const loadRafflePlayers = async (teamId) => {
  const request = ++rafflePlayerRequest;
  raffleBlacklistPlayer.disabled = true;
  raffleBlacklistPlayer.innerHTML = '<option value="">Loading players…</option>';
  try {
    const players = await rpc('mvl_get_team_players', { p_team_id: teamId });
    if (request !== rafflePlayerRequest) return;
    raffleBlacklistPlayer.innerHTML = players.length
      ? `<option value="">Choose player</option>${players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.name)}${player.jerseyNumber ? ` · #${escapeHtml(player.jerseyNumber)}` : ''}</option>`).join('')}`
      : '<option value="">No rostered players</option>';
    raffleBlacklistPlayer.disabled = !players.length;
  } catch (error) {
    if (request !== rafflePlayerRequest) return;
    raffleBlacklistPlayer.innerHTML = '<option value="">Could not load players</option>';
    status(raffleBlacklistForm.querySelector('.form-status'), error.message, 'error');
  }
};
const renderRaffleBlacklist = (entries) => {
  if (!entries.length) {
    raffleBlacklistList.innerHTML = '<p class="admin-readiness-empty">No raffle winners recorded yet.</p>';
    return;
  }
  raffleBlacklistList.innerHTML = `<table class="admin-raffle-table">
    <thead><tr><th>Player</th><th>Prize / note</th><th>Added</th><th></th></tr></thead>
    <tbody>${entries.map((entry) => `<tr>
      <td><strong>${escapeHtml(entry.playerName)}</strong><span>${teamNameMarkup(entry.teamId, entry.teamName)}${entry.jerseyNumber ? ` · #${escapeHtml(entry.jerseyNumber)}` : ''}</span></td>
      <td>${escapeHtml(entry.note)}</td>
      <td>${escapeHtml(formatAdminDate(entry.createdAt))}</td>
      <td><button class="admin-raffle-remove" type="button" data-raffle-remove="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(entry.playerName)} from Raffle Winners">Remove</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
};
const loadRaffleBlacklist = async () => {
  raffleBlacklistList.innerHTML = '<p class="admin-readiness-empty">Loading raffle winners…</p>';
  try {
    renderRaffleBlacklist(await rpc('mvl_admin_get_raffle_blacklist'));
  } catch (error) {
    raffleBlacklistList.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
  }
};
const clearRaffleAnimation = () => {
  raffleDrawToken += 1;
  if (raffleSpinFrame) window.cancelAnimationFrame(raffleSpinFrame);
  raffleSpinFrame = null;
  raffleDrawPool.style.transition = 'none';
  raffleDrawingView.classList.remove('is-animating');
};
const rafflePoolEntry = (entry) => typeof entry === 'string'
  ? { playerName: entry, teamId: '', teamName: '' }
  : {
    playerName: entry?.playerName || 'Player',
    teamId: entry?.teamId || '',
    teamName: entry?.teamName || teams[entry?.teamId]?.name || '',
  };
const shuffleRaffleEntries = (entries) => {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};
const raffleGradient = (teamId) => {
  const fallback = ['#475467', '#25324a'];
  const gradient = teams[teamId]?.grad || fallback;
  return gradient.map((color, index) => (/^#[0-9a-f]{6}$/i.test(color || '') ? color : fallback[index]));
};
const renderRaffleRoulette = (pool, winner) => {
  const entries = pool.map(rafflePoolEntry);
  const visualRows = [];
  const rowCount = Math.max(42, Math.min(70, entries.length * 2));
  while (visualRows.length < rowCount) {
    visualRows.push(...shuffleRaffleEntries(entries));
  }
  visualRows.length = rowCount;
  const winnerIndex = visualRows.length;
  visualRows.push(rafflePoolEntry(winner));
  visualRows.push(entries[Math.floor(Math.random() * entries.length)] || rafflePoolEntry(winner));
  raffleDrawPool.innerHTML = visualRows.map((entry, index) => {
    const [start, end] = raffleGradient(entry.teamId);
    return `<div class="admin-raffle-roulette-row${index === winnerIndex ? ' is-winner' : ''}" style="--raffle-start:${start};--raffle-end:${end}"><strong>${escapeHtml(entry.playerName)}</strong><span>${escapeHtml(entry.teamName)}</span></div>`;
  }).join('');
  const rowHeight = 64;
  const viewportHeight = 192;
  return (viewportHeight / 2) - (rowHeight / 2) - (winnerIndex * rowHeight);
};
const revealRaffleWinner = (winner) => {
  currentRaffleWinner = winner;
  raffleDrawTitle.textContent = 'We have a winner!';
  raffleDrawingView.classList.add('is-hidden');
  raffleDrawingView.classList.remove('is-animating');
  raffleWinnerView.classList.remove('is-hidden');
  raffleWinnerName.textContent = winner.playerName;
  raffleWinnerMeta.textContent = `${winner.teamName}${winner.jerseyNumber ? ` · #${winner.jerseyNumber}` : ''}`;
  raffleWinnerFurparent.textContent = furparentLabel(winner.furparentType);
  raffleWinnerForm.reset();
  status(raffleWinnerForm.querySelector('.form-status'), '');
  const addButton = raffleWinnerForm.querySelector('button[type="submit"]');
  addButton.disabled = false;
  addButton.textContent = 'Add to Raffle Winners';
  if (winner.photoUrl) {
    raffleWinnerPhoto.src = winner.photoUrl;
    raffleWinnerPhoto.alt = `${winner.playerName}, raffle winner`;
    raffleWinnerPhoto.classList.remove('is-hidden');
    raffleWinnerPhotoFallback.classList.add('is-hidden');
  } else {
    raffleWinnerPhoto.removeAttribute('src');
    raffleWinnerPhoto.classList.add('is-hidden');
    raffleWinnerPhotoFallback.classList.remove('is-hidden');
  }
  window.setTimeout(() => raffleWinnerForm.elements.note.focus(), 120);
};
const animateRaffleDraw = async (payload) => {
  clearRaffleAnimation();
  const token = raffleDrawToken;
  const pool = payload.pool || [];
  currentRaffleWinner = null;
  raffleDrawTitle.textContent = 'Drawing a winner';
  raffleDrawCount.textContent = payload.entryCount;
  raffleDrawCountdown.textContent = 'Winner in 5 seconds';
  raffleWinnerView.classList.add('is-hidden');
  raffleDrawingView.classList.remove('is-hidden');
  raffleDrawingView.classList.remove('is-animating');
  void raffleDrawingView.offsetWidth;
  raffleDrawingView.classList.add('is-animating');
  const rouletteOffset = renderRaffleRoulette(pool, payload.winner);
  raffleDrawPool.style.transition = 'none';
  raffleDrawPool.style.transform = 'translateY(0)';
  if (!raffleDrawDialog.open) raffleDrawDialog.showModal();
  void raffleDrawPool.offsetHeight;
  raffleSpinFrame = window.requestAnimationFrame(() => {
    raffleDrawPool.style.transition = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'none'
      : 'transform 5s cubic-bezier(.12,.72,.08,1)';
    raffleDrawPool.style.transform = `translateY(${rouletteOffset}px)`;
  });
  for (let remaining = 5; remaining > 0; remaining -= 1) {
    raffleDrawCountdown.textContent = `Winner in ${remaining} second${remaining === 1 ? '' : 's'}`;
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    if (token !== raffleDrawToken || !raffleDrawDialog.open) return;
  }
  raffleSpinFrame = null;
  revealRaffleWinner(payload.winner);
};
const readinessCount = (count, total, completeClass = true) => {
  const isComplete = total > 0 && count === total;
  return `<span class="admin-readiness-count ${isComplete && completeClass ? 'is-complete' : ''}"><strong>${count}</strong> / ${total}</span>`;
};
const renderReadiness = (readiness) => {
  const selectedDay = readiness.selectedDay;
  const availableDays = [...readiness.days];
  if (!availableDays.some((day) => day.date === selectedDay)) {
    availableDays.push({ date: selectedDay, dayNumber: null });
    availableDays.sort((a, b) => a.date.localeCompare(b.date));
  }
  readinessTeamFilter.innerHTML = readiness.teams.map((team) => (
    `<option value="${escapeHtml(team.id)}" style="color:${adminTeamColor(team.id)}" ${team.id === readiness.selectedTeam ? 'selected' : ''}>${escapeHtml(team.name)}</option>`
  )).join('');
  readinessDayFilter.innerHTML = availableDays.map((day) => {
    const prefix = day.dayNumber ? `Day ${day.dayNumber} · ` : '';
    return `<option value="${escapeHtml(day.date)}" ${day.date === selectedDay ? 'selected' : ''}>${prefix}${escapeHtml(formatReadinessDay(day.date))}</option>`;
  }).join('');

  const teamSummary = readiness.teamSummary || [];
  readinessTeamSummary.innerHTML = teamSummary.length ? `<table class="admin-readiness-table admin-readiness-team-table">
    <thead><tr><th>Team</th><th>Roster</th><th>Waivers</th><th>Checked in</th></tr></thead>
    <tbody>${teamSummary.map((team) => {
      const checkinNotes = [];
      if (team.outsideRadiusCount) checkinNotes.push(`${team.outsideRadiusCount} outside venue`);
      if (team.unmatchedCheckinCount) checkinNotes.push(`${team.unmatchedCheckinCount} unmatched`);
      return `<tr class="${team.teamId === readiness.selectedTeam ? 'is-selected' : ''}">
        <td><button class="admin-team-detail-link" type="button" data-readiness-team="${escapeHtml(team.teamId)}" style="--team-color:${adminTeamColor(team.teamId)}">${escapeHtml(team.teamName)}</button></td>
        <td>${team.rosterCount}</td>
        <td>${readinessCount(team.waiverCount, team.rosterCount)}</td>
        <td>${readinessCount(team.checkinCount, team.rosterCount)}${checkinNotes.length ? `<span class="admin-status-detail">${escapeHtml(checkinNotes.join(' · '))}</span>` : ''}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>` : '<p class="admin-readiness-empty">No tournament teams found.</p>';

  const players = readiness.players || [];
  readinessPlayers = new Map(players.map((player) => [player.id, player]));
  const waiverCount = players.filter((player) => player.waiverCompleted).length;
  const checkinCount = players.filter((player) => player.checkinStatus === 'checked_in').length;
  readinessSummary.textContent = `${waiverCount} of ${players.length} waivers complete · ${checkinCount} of ${players.length} players checked in`;

  if (!players.length) {
    readinessTable.innerHTML = '<p class="admin-readiness-empty">No rostered players found for this team.</p>';
  } else {
    readinessTable.innerHTML = `<table class="admin-readiness-table">
      <thead><tr><th>Player</th><th>Waiver</th><th>Daily check-in</th></tr></thead>
      <tbody>${players.map((player) => {
        const checkinLabel = player.checkinStatus === 'checked_in'
          ? 'Checked in'
          : player.checkinStatus === 'outside_radius' ? 'Outside venue' : 'Not checked in';
        const checkinClass = player.checkinStatus === 'checked_in'
          ? 'is-complete'
          : player.checkinStatus === 'outside_radius' ? 'is-warning' : '';
        const checkinTime = player.checkedInAt || player.checkinAttemptedAt;
        const instagram = instagramDisplay(player.instagramHandle);
        const playerIdentifiers = `${player.jerseyNumber ? `#${escapeHtml(player.jerseyNumber)}` : 'No jersey number'}${instagram ? ` · <b class="admin-player-instagram">${escapeHtml(instagram)}</b>` : ''}`;
        const emergencyButton = player.hasEmergencyContact
          ? `<button class="admin-emergency-button" type="button" data-emergency-player="${escapeHtml(player.id)}" aria-label="View emergency contact for ${escapeHtml(player.name)}" title="View emergency contact"><span aria-hidden="true">✚</span></button>`
          : '';
        return `<tr>
          <td class="admin-player-name"><strong>${escapeHtml(player.name)}</strong><div class="admin-player-meta"><span class="admin-player-identifiers">${playerIdentifiers}</span>${emergencyButton}</div></td>
          <td><span class="admin-status-badge ${player.waiverCompleted ? 'is-complete' : ''}">${player.waiverCompleted ? 'Complete' : 'Pending'}</span>${player.waiverSubmittedAt ? `<span class="admin-status-detail">${escapeHtml(formatAdminDate(player.waiverSubmittedAt))}</span>` : ''}</td>
          <td><span class="admin-status-badge ${checkinClass}">${checkinLabel}</span>${checkinTime ? `<span class="admin-status-detail">${escapeHtml(formatAdminTime(checkinTime))}</span>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  const unmatched = readiness.unmatchedCheckins || [];
  if (unmatched.length) {
    unmatchedCheckins.innerHTML = `<strong>Unmatched check-ins (${unmatched.length})</strong><p>These names do not match a player on this team's roster. Review spelling before using them as player attendance.</p><ul>${unmatched.map((entry) => `<li>${escapeHtml(entry.name)} · ${entry.status === 'checked_in' ? 'checked in' : 'outside venue'}</li>`).join('')}</ul>`;
    unmatchedCheckins.classList.remove('is-hidden');
  } else {
    unmatchedCheckins.innerHTML = '';
    unmatchedCheckins.classList.add('is-hidden');
  }
};
const loadReadiness = async (teamId = null, day = null) => {
  const request = ++readinessRequest;
  readinessPlayers = new Map();
  if (emergencyContactDialog.open) emergencyContactDialog.close();
  readinessSummary.textContent = 'Loading player status…';
  readinessTeamSummary.innerHTML = '<p class="admin-readiness-empty">Loading team summary…</p>';
  readinessTable.innerHTML = '';
  try {
    const [readiness, summary] = await Promise.all([
      rpc('mvl_admin_get_player_readiness', {
        p_team_id: teamId || null,
        p_day: day || null,
      }),
      rpc('mvl_admin_get_readiness_summary', { p_day: day || null }),
    ]);
    if (request !== readinessRequest) return;
    const contactIndex = await rpc('mvl_admin_get_player_contact_index', {
      p_team_id: readiness.selectedTeam,
    });
    if (request !== readinessRequest) return;
    const contactsByPlayer = new Map(contactIndex.map((contact) => [contact.playerId, contact]));
    readiness.players = (readiness.players || []).map((player) => ({
      ...player,
      instagramHandle: contactsByPlayer.get(player.id)?.instagramHandle || '',
      hasEmergencyContact: contactsByPlayer.get(player.id)?.hasEmergencyContact === true,
    }));
    readiness.teamSummary = summary.teams;
    renderReadiness(readiness);
  } catch (error) {
    if (request !== readinessRequest) return;
    readinessSummary.textContent = 'Player readiness could not be loaded.';
    readinessTeamSummary.innerHTML = '';
    readinessTable.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
    unmatchedCheckins.classList.add('is-hidden');
  }
};
const findPlayer = async (form, game) => {
  const winner = form.elements.winner.value;
  const lookup = form.elements.playerLookup.value.trim();
  if (!winner) throw new Error('Choose the winner before looking up the Player of the Game.');
  if (!lookup) {
    form.elements.playerId.value = '';
    form.querySelector('[data-player-preview]').outerHTML = playerPreview(null);
    return null;
  }
  const player = await rpc('mvl_admin_lookup_player', {
    p_game_id: game.id,
    p_winner_team_id: winner,
    p_lookup: lookup,
  });
  form.elements.playerId.value = player.id;
  form.elements.playerLookup.value = player.lookupKey;
  form.querySelector('[data-player-preview]').outerHTML = playerPreview(player);
  return player;
};
const render = () => {
  const allGames = data.publicData.games;
  const days = [...new Set(allGames.map((game) => game.day))].sort((a, b) => a - b);
  if (!days.includes(activeAdminDay)) activeAdminDay = days[0];
  const dayGames = allGames.filter((game) => game.day === activeAdminDay);
  adminDayFilter.innerHTML = days.map((day) => {
    const first = allGames.find((game) => game.day === day);
    return `<option value="${day}" ${day === activeAdminDay ? 'selected' : ''}>Day ${day} · ${formatAdminDay(first.startsAt)}</option>`;
  }).join('');
  adminDaySummary.textContent = `${dayGames.length} games · ${formatAdminDay(dayGames[0].startsAt)}`;
  document.getElementById('adminGameList').innerHTML = dayGames.map((g) => {
    const setCount = g.id.startsWith('pre-') ? 3 : 5;
    const videos = gameVideos(g);
    return `<form class="admin-panel admin-game admin-form" data-id="${g.id}">
    <div class="admin-panel-head"><div><p class="games-label">Day ${g.day} · ${g.court} · ${g.status}</p><h3>${gameTeamMarkup(g, 'A')} <em>vs</em> ${gameTeamMarkup(g, 'B')}</h3></div><button type="button" class="admin-link" data-reset>Reset</button></div>
    <div class="admin-result-fields">
      <label class="field"><span>Winner</span><select name="winner" required ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><option value="">Choose winner</option><option value="${g.teamA}" ${g.teamALabel ? '' : `style="color:${adminTeamColor(g.teamA)}"`} ${g.winner === g.teamA ? 'selected' : ''}>${gameTeamName(g, 'A')}</option><option value="${g.teamB}" ${g.teamBLabel ? '' : `style="color:${adminTeamColor(g.teamB)}"`} ${g.winner === g.teamB ? 'selected' : ''}>${gameTeamName(g, 'B')}</option></select></label>
      <label class="field"><span>Player of the Game</span><div class="admin-player-search"><input name="playerLookup" type="text" value="${escapeHtml(g.playerOfGame?.lookupKey || '')}" placeholder="santos-04" autocomplete="off"><button type="button" class="cta cta--secondary" data-find-player>Find</button></div><small>Enter surname and jersey number. Lookup is limited to the selected winner.</small><input name="playerId" type="hidden" value="${escapeHtml(g.playerOfGame?.id || '')}"></label>
    </div>
    ${playerPreview(g.playerOfGame)}
    <section class="admin-video-editor">
      <div class="admin-video-head"><div><strong>Game videos</strong><small>Add a custom label for every recording, such as Full Game, Set 1, or Set 2.</small></div><button type="button" class="admin-link" data-add-video>+ Add video</button></div>
      <div class="admin-video-list" data-video-list>${(videos.length ? videos : [{}]).map(videoRow).join('')}</div>
    </section>
    <div class="admin-score-heading"><span>Set</span><strong>${gameTeamMarkup(g, 'A')}</strong><strong>${gameTeamMarkup(g, 'B')}</strong></div>
    <div class="admin-sets">${Array.from({ length: setCount }, (_, i) => `<label><span>Set ${i+1}</span><input name="a${i}" aria-label="${gameTeamName(g, 'A')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.a ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><input name="b${i}" aria-label="${gameTeamName(g, 'B')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.b ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}></label>`).join('')}</div>
    <button class="cta cta--primary" ${g.teamALabel || g.teamBLabel ? 'disabled title="The teams will be assigned automatically from tournament results."' : ''}>Save result, player & videos</button><p class="form-status"></p></form>`;
  }).join('');
};
const show = async () => {
  try {
    data = await rpc('mvl_admin_get_dashboard');
    loginPanel.classList.add('is-hidden'); dashboard.classList.remove('is-hidden'); signOutBtn.classList.remove('is-hidden');
    adminIdentity.textContent = data.email;
    const live = data.publicData.livestream, form = livestreamForm.elements;
    const streams = Array.isArray(live.streams) ? live.streams : [live, {}];
    form.court1Live.checked = Boolean(streams[0]?.is_live);
    form.court1Url.value = streams[0]?.youtube_url || live.youtube_url || '';
    form.court2Live.checked = Boolean(streams[1]?.is_live);
    form.court2Url.value = streams[1]?.youtube_url || '';
    render();
    activateAdminTab(adminTabFromHash());
    await Promise.all([loadReadiness(), loadScoreboards(), loadRaffleBlacklist()]);
  } catch (e) {
    session = null;
    authClient.auth.signOut();
    status(loginStatus, e.message === 'Admin access required' ? 'This Google account is not an MVL administrator.' : e.message, 'error');
  }
};
googleSignInBtn.addEventListener('click', async () => {
  status(loginStatus, 'Redirecting to Google…');
  const { error } = await authClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/mvl/admin` },
  });
  if (error) status(loginStatus, error.message, 'error');
});
document.querySelector('.admin-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-admin-tab]');
  if (tab) activateAdminTab(tab.dataset.adminTab, { updateUrl: true });
});
document.querySelector('.admin-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = adminTabs.findIndex((tab) => tab.classList.contains('is-active'));
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? adminTabs.length - 1
      : event.key === 'ArrowRight' ? (currentIndex + 1) % adminTabs.length
        : (currentIndex - 1 + adminTabs.length) % adminTabs.length;
  activateAdminTab(adminTabs[nextIndex].dataset.adminTab, { updateUrl: true, focus: true });
});
window.addEventListener('popstate', () => activateAdminTab(adminTabFromHash()));
window.addEventListener('hashchange', () => activateAdminTab(adminTabFromHash()));
streamSetupGuide.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-stream-camera-tab]');
  if (tab) activateStreamCamera(tab.dataset.streamCameraTab);
});
streamSetupGuide.addEventListener('keydown', (event) => {
  const tab = event.target.closest('[data-stream-camera-tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = streamCameraTabs.indexOf(tab);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? streamCameraTabs.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % streamCameraTabs.length
        : (index - 1 + streamCameraTabs.length) % streamCameraTabs.length;
  activateStreamCamera(streamCameraTabs[nextIndex].dataset.streamCameraTab, { focus: true });
});
newScoreboardBtn.addEventListener('click', () => {
  scoreboardCreateForm.classList.remove('is-hidden');
  newScoreboardBtn.classList.add('is-hidden');
  scoreboardCreateForm.elements.name.focus();
});
scoreboardCreateForm.addEventListener('click', (event) => {
  if (!event.target.closest('[data-cancel-scoreboard]')) return;
  scoreboardCreateForm.reset();
  populateScoreboardTeams();
  scoreboardCreateForm.classList.add('is-hidden');
  newScoreboardBtn.classList.remove('is-hidden');
});
scoreboardCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formStatus = form.querySelector('.form-status');
  status(formStatus, 'Creating…');
  try {
    if (form.elements.leftTeam.value === form.elements.rightTeam.value) throw new Error('Choose two different teams.');
    await rpc('mvl_admin_create_scoreboard', {
      p_name: form.elements.name.value,
      p_team_left_id: form.elements.leftTeam.value,
      p_team_right_id: form.elements.rightTeam.value,
    });
    form.reset();
    populateScoreboardTeams();
    form.classList.add('is-hidden');
    newScoreboardBtn.classList.remove('is-hidden');
    await loadScoreboards();
  } catch (error) {
    status(formStatus, error.message, 'error');
  }
});
scoreboardList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy-url]');
  if (!button) return;
  const cardStatus = button.closest('.admin-scoreboard-card').querySelector('.form-status');
  try {
    await copyText(button.dataset.copyUrl);
    status(cardStatus, button.textContent.includes('OBS') ? 'OBS link copied.' : 'Control link copied.', 'success');
  } catch {
    status(cardStatus, 'Could not copy the link. Open Manage and copy it there.', 'error');
  }
});
livestreamForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = e.target.querySelector('.form-status');
  const f = e.target.elements;
  status(s, 'Saving…');
  try {
    const streams = [
      { court: 'Court 1', is_live: f.court1Live.checked, youtube_url: f.court1Url.value.trim(), youtube_id: youtubeId(f.court1Url.value) || '' },
      { court: 'Court 2', is_live: f.court2Live.checked, youtube_url: f.court2Url.value.trim(), youtube_id: youtubeId(f.court2Url.value) || '' },
    ];
    await rpc('mvl_admin_update_livestreams', { p_streams: streams });
    data = await rpc('mvl_admin_get_dashboard');
    status(s, 'Court livestreams updated.', 'success');
  } catch (err) {
    status(s, err.message, 'error');
  }
});
raffleExportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formStatus = form.querySelector('.form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  status(formStatus, 'Preparing export…');
  submitButton.disabled = true;
  try {
    const payload = await rpc('mvl_admin_get_raffle_entries', {
      p_start_date: form.elements.startDate.value,
      p_end_date: form.elements.endDate.value,
      p_furparent_only: form.elements.furparentOnly.checked,
    });
    if (!payload.entries?.length) {
      const excluded = payload.blacklistedExcluded ? ` ${payload.blacklistedExcluded} past winner${payload.blacklistedExcluded === 1 ? ' was' : 's were'} excluded.` : '';
      status(formStatus, `No eligible check-ins found for this selection.${excluded}`, 'error');
      return;
    }
    downloadRaffleCsv(payload);
    const excluded = payload.blacklistedExcluded ? ` · ${payload.blacklistedExcluded} past winner${payload.blacklistedExcluded === 1 ? '' : 's'} excluded` : '';
    status(formStatus, `${payload.entryCount} raffle ${payload.entryCount === 1 ? 'entry' : 'entries'} downloaded${excluded}.`, 'success');
  } catch (error) {
    status(formStatus, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});
raffleDrawBtn.addEventListener('click', async () => {
  if (!raffleExportForm.reportValidity()) return;
  const formStatus = raffleExportForm.querySelector('.form-status');
  status(formStatus, 'Preparing the raffle pool…');
  raffleDrawBtn.disabled = true;
  try {
    const payload = await rpc('mvl_admin_draw_raffle_winner', {
      p_start_date: raffleExportForm.elements.startDate.value,
      p_end_date: raffleExportForm.elements.endDate.value,
      p_furparent_only: raffleExportForm.elements.furparentOnly.checked,
    });
    if (!payload.winner || !payload.pool?.length) {
      status(formStatus, 'No eligible check-ins found for this selection.', 'error');
      return;
    }
    status(formStatus, '');
    animateRaffleDraw(payload);
  } catch (error) {
    status(formStatus, error.message, 'error');
  } finally {
    raffleDrawBtn.disabled = false;
  }
});
raffleBlacklistTeam.addEventListener('change', () => loadRafflePlayers(raffleBlacklistTeam.value));
raffleBlacklistForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formStatus = form.querySelector('.form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  status(formStatus, 'Saving…');
  submitButton.disabled = true;
  try {
    await rpc('mvl_admin_add_raffle_blacklist', {
      p_player_id: form.elements.player.value,
      p_note: form.elements.note.value,
    });
    form.elements.note.value = '';
    form.elements.player.value = '';
    await loadRaffleBlacklist();
    status(formStatus, 'Player added to Raffle Winners.', 'success');
  } catch (error) {
    status(formStatus, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});
raffleBlacklistList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-raffle-remove]');
  if (!button || !window.confirm('Remove this player from Raffle Winners?')) return;
  button.disabled = true;
  try {
    await rpc('mvl_admin_remove_raffle_blacklist', { p_blacklist_id: button.dataset.raffleRemove });
    await loadRaffleBlacklist();
    status(raffleBlacklistForm.querySelector('.form-status'), 'Player removed from Raffle Winners.', 'success');
  } catch (error) {
    button.disabled = false;
    status(raffleBlacklistForm.querySelector('.form-status'), error.message, 'error');
  }
});
raffleWinnerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentRaffleWinner) return;
  const form = event.currentTarget;
  const formStatus = form.querySelector('.form-status');
  const submitButton = form.querySelector('button[type="submit"]');
  status(formStatus, 'Saving winner…');
  submitButton.disabled = true;
  try {
    await rpc('mvl_admin_add_raffle_blacklist', {
      p_player_id: currentRaffleWinner.playerId,
      p_note: form.elements.note.value,
    });
    await loadRaffleBlacklist();
    submitButton.textContent = 'Saved in Raffle Winners';
    status(formStatus, 'Winner saved and excluded from future draws.', 'success');
  } catch (error) {
    submitButton.disabled = false;
    status(formStatus, error.message, 'error');
  }
});
raffleWinnerPhoto.addEventListener('error', () => {
  raffleWinnerPhoto.classList.add('is-hidden');
  raffleWinnerPhotoFallback.classList.remove('is-hidden');
});
raffleDrawDialog.addEventListener('close', clearRaffleAnimation);
raffleDrawDialog.addEventListener('click', (event) => {
  if (event.target === raffleDrawDialog) raffleDrawDialog.close();
});
adminDayFilter.addEventListener('change', () => { activeAdminDay = Number(adminDayFilter.value); render(); });
readinessTeamFilter.addEventListener('change', () => {
  loadReadiness(readinessTeamFilter.value, readinessDayFilter.value);
});
readinessDayFilter.addEventListener('change', () => {
  loadReadiness(readinessTeamFilter.value, readinessDayFilter.value);
});
readinessTeamSummary.addEventListener('click', (event) => {
  const button = event.target.closest('[data-readiness-team]');
  if (!button) return;
  loadReadiness(button.dataset.readinessTeam, readinessDayFilter.value);
});
readinessTable.addEventListener('click', (event) => {
  const button = event.target.closest('[data-emergency-player]');
  if (!button) return;
  const player = readinessPlayers.get(button.dataset.emergencyPlayer);
  if (player) openEmergencyContact(player);
});
emergencyContactDialog.addEventListener('close', clearEmergencyContact);
emergencyContactDialog.addEventListener('click', (event) => {
  if (event.target === emergencyContactDialog) emergencyContactDialog.close();
});
adminGameList.addEventListener('change', (e) => {
  if (!e.target.matches('[name="winner"]')) return;
  const form = e.target.closest('[data-id]');
  form.elements.playerLookup.value = '';
  form.elements.playerId.value = '';
  form.querySelector('[data-player-preview]').outerHTML = playerPreview(null);
});
adminGameList.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-id]');
  if (!form) return;
  e.preventDefault();
  const s = form.querySelector('.form-status');
  const g = data.publicData.games.find((game) => game.id === form.dataset.id);
  const setCount = g.id.startsWith('pre-') ? 3 : 5;
  const sets = Array.from({ length: setCount }, (_, i) => i)
    .filter((i) => form.elements[`a${i}`].value !== '' && form.elements[`b${i}`].value !== '')
    .map((i) => ({
      team_a_score: +form.elements[`a${i}`].value,
      team_b_score: +form.elements[`b${i}`].value,
    }));
  status(s, 'Saving…');
  try {
    if (!sets.length) throw new Error('Enter at least one set.');
    const videos = [...form.querySelectorAll('[data-video-row]')].map((row) => {
      const label = row.querySelector('[data-video-label]').value.trim();
      const url = row.querySelector('[data-video-url]').value.trim();
      if (!url) return null;
      const id = youtubeId(url);
      if (!label) throw new Error('Add a label for every YouTube URL.');
      if (!validYouTubeId(id)) throw new Error(`"${label}" does not have a valid YouTube URL.`);
      return { label, youtube_id: id };
    }).filter(Boolean);
    if (new Set(videos.map((video) => video.youtube_id)).size !== videos.length) {
      throw new Error('The same YouTube video cannot be added twice to one game.');
    }
    const player = form.elements.playerLookup.value.trim() ? await findPlayer(form, g) : null;
    await rpc('mvl_admin_save_game_result', {
      p_game_id: g.id,
      p_winner_team_id: form.elements.winner.value,
      p_player_of_game_id: player?.id || null,
      p_sets: sets,
      p_videos: videos,
    });
    data = await rpc('mvl_admin_get_dashboard');
    render();
    const refreshed = document.querySelector(`[data-id="${g.id}"] .form-status`);
    status(refreshed, 'Result, player, and videos updated.', 'success');
  } catch (err) {
    status(s, err.message, 'error');
  }
});
adminGameList.addEventListener('click', async (e) => {
  const addVideoButton = e.target.closest('[data-add-video]');
  if (addVideoButton) {
    addVideoButton.closest('[data-id]').querySelector('[data-video-list]').insertAdjacentHTML('beforeend', videoRow({ label: '' }));
    return;
  }
  const removeVideoButton = e.target.closest('[data-remove-video]');
  if (removeVideoButton) {
    const list = removeVideoButton.closest('[data-video-list]');
    const rows = list.querySelectorAll('[data-video-row]');
    if (rows.length > 1) {
      removeVideoButton.closest('[data-video-row]').remove();
    } else {
      rows[0].querySelector('[data-video-label]').value = 'Full Game';
      rows[0].querySelector('[data-video-url]').value = '';
    }
    return;
  }
  const findButton = e.target.closest('[data-find-player]');
  if (findButton) {
    const form = findButton.closest('[data-id]');
    const s = form.querySelector('.form-status');
    const g = data.publicData.games.find((game) => game.id === form.dataset.id);
    status(s, 'Looking up player…');
    try {
      const player = await findPlayer(form, g);
      status(s, player ? 'Player found.' : 'Player selection cleared.', 'success');
    } catch (err) {
      form.elements.playerId.value = '';
      form.querySelector('[data-player-preview]').outerHTML = playerPreview(null);
      status(s, err.message, 'error');
    }
    return;
  }
  const btn = e.target.closest('[data-reset]');
  if (!btn) return;
  const form = btn.closest('[data-id]');
  const s = form.querySelector('.form-status');
  status(s, 'Resetting…');
  try {
    await rpc('mvl_admin_reset_game', { p_game_id: form.dataset.id });
    form.elements.winner.value = '';
    form.elements.playerLookup.value = '';
    form.elements.playerId.value = '';
    form.querySelector('[data-player-preview]').outerHTML = playerPreview(null);
    form.querySelectorAll('.admin-sets input').forEach((input) => { input.value = ''; });
    status(s, 'Reset to pending.', 'success');
  } catch (err) {
    status(s, err.message, 'error');
  }
});
signOutBtn.addEventListener('click', async()=>{await authClient.auth.signOut();location.reload();});
authClient.auth.onAuthStateChange((_event, nextSession) => {
  if (nextSession?.access_token && nextSession.access_token !== session?.access_token) {
    session = nextSession;
    window.setTimeout(show, 0);
  }
});
authClient.auth.getSession().then(({ data: authData }) => {
  session = authData.session;
  if (session?.access_token) show();
});
activateAdminTab(adminTabFromHash());
populateScoreboardTeams();
populateRaffleTeams();
raffleExportForm.elements.startDate.value = manilaDateInput();
raffleExportForm.elements.endDate.value = manilaDateInput();
loadRafflePlayers(raffleBlacklistTeam.value);
