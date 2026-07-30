const cfg = window.MVL_SUPABASE;
const authClient = window.supabase.createClient(cfg.url, cfg.anonKey);
let session = null;
let data;
let activeAdminDay = 1;
const teams = Object.fromEntries(window.MVL_DATA.teams.map((t) => [t.id, t]));
const gameTeamName = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  return label || teams[id]?.name || 'TBD';
};
const status = (el, text, type = '') => { el.textContent = text; el.className = `form-status ${type ? `is-${type}` : ''}`; };
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));
const playerPhotoUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${cfg.url}/storage/v1/object/public/mvl-player-photos/${path}`;
};
const playerPreview = (player) => {
  if (!player) return '<div class="admin-player-preview is-empty" data-player-preview>No player selected</div>';
  const photo = playerPhotoUrl(player.photoPath);
  return `<div class="admin-player-preview" data-player-preview>
    ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<div class="admin-player-photo-placeholder">No photo</div>'}
    <div><strong>${escapeHtml(player.name)}</strong><span>#${escapeHtml(player.jerseyNumber || '—')} · ${escapeHtml(teams[player.team]?.name || player.team)}</span></div>
  </div>`;
};
const call = async (path, body, token = session?.access_token) => {
  const res = await fetch(`${cfg.url}${path}`, { method: 'POST', headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token || cfg.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error_description || 'Request failed');
  return json;
};
const rpc = (name, body) => call(`/rest/v1/rpc/${name}`, body);
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
const formatAdminDay = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', weekday: 'short',
}).format(new Date(iso));
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
    return `<form class="admin-panel admin-game admin-form" data-id="${g.id}">
    <div class="admin-panel-head"><div><p class="games-label">Day ${g.day} · ${g.court} · ${g.status}</p><h3>${gameTeamName(g, 'A')} <em>vs</em> ${gameTeamName(g, 'B')}</h3></div><button type="button" class="admin-link" data-reset>Reset</button></div>
    <div class="admin-result-fields">
      <label class="field"><span>Winner</span><select name="winner" required ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><option value="">Choose winner</option><option value="${g.teamA}" ${g.winner === g.teamA ? 'selected' : ''}>${gameTeamName(g, 'A')}</option><option value="${g.teamB}" ${g.winner === g.teamB ? 'selected' : ''}>${gameTeamName(g, 'B')}</option></select></label>
      <label class="field"><span>Player of the Game</span><div class="admin-player-search"><input name="playerLookup" type="text" value="${escapeHtml(g.playerOfGame?.lookupKey || '')}" placeholder="santos-04" autocomplete="off"><button type="button" class="cta cta--secondary" data-find-player>Find</button></div><small>Enter surname and jersey number. Lookup is limited to the selected winner.</small><input name="playerId" type="hidden" value="${escapeHtml(g.playerOfGame?.id || '')}"></label>
      <label class="field"><span>YouTube link</span><input name="youtubeUrl" type="url" value="${g.youtubeId ? `https://www.youtube.com/watch?v=${g.youtubeId}` : ''}" placeholder="https://youtube.com/watch?v=..."></label>
    </div>
    ${playerPreview(g.playerOfGame)}
    <div class="admin-score-heading"><span>Set</span><strong>${gameTeamName(g, 'A')}</strong><strong>${gameTeamName(g, 'B')}</strong></div>
    <div class="admin-sets">${Array.from({ length: setCount }, (_, i) => `<label><span>Set ${i+1}</span><input name="a${i}" aria-label="${gameTeamName(g, 'A')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.a ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><input name="b${i}" aria-label="${gameTeamName(g, 'B')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.b ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}></label>`).join('')}</div>
    <button class="cta cta--primary" ${g.teamALabel || g.teamBLabel ? 'disabled title="The teams will be assigned automatically from tournament results."' : ''}>Save result, player & video</button><p class="form-status"></p></form>`;
  }).join('');
};
const show = async () => {
  try {
    data = await rpc('mvl_admin_get_dashboard');
    loginPanel.classList.add('is-hidden'); dashboard.classList.remove('is-hidden'); signOutBtn.classList.remove('is-hidden');
    adminIdentity.textContent = data.email;
    const live = data.publicData.livestream, form = livestreamForm.elements;
    form.isLive.checked = live.is_live; form.youtubeUrl.value = live.youtube_url || '';
    render();
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
livestreamForm.addEventListener('submit', async (e) => { e.preventDefault(); const s = e.target.querySelector('.form-status'), f = e.target.elements; status(s, 'Saving…'); try { const id = youtubeId(f.youtubeUrl.value) || ''; await rpc('mvl_admin_update_livestream', { p_is_live: f.isLive.checked, p_youtube_url: f.youtubeUrl.value, p_youtube_id: id }); status(s, 'Livestream updated.', 'success'); } catch (err) { status(s, err.message, 'error'); } });
adminDayFilter.addEventListener('change', () => { activeAdminDay = Number(adminDayFilter.value); render(); });
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
    const player = form.elements.playerLookup.value.trim() ? await findPlayer(form, g) : null;
    await rpc('mvl_record_game_result', {
      p_game_id: g.id,
      p_winner_team_id: form.elements.winner.value,
      p_player_of_game_id: player?.id || null,
      p_sets: sets,
      p_youtube_id: youtubeId(form.elements.youtubeUrl.value),
      p_video_title: `${gameTeamName(g, 'A')} vs ${gameTeamName(g, 'B')} · Full Game`,
      p_duration_seconds: null,
      p_video_published_at: new Date().toISOString(),
      p_video_is_featured: true,
    });
    data = await rpc('mvl_admin_get_dashboard');
    render();
    const refreshed = document.querySelector(`[data-id="${g.id}"] .form-status`);
    status(refreshed, 'Result, player, and video updated.', 'success');
  } catch (err) {
    status(s, err.message, 'error');
  }
});
adminGameList.addEventListener('click', async (e) => {
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
