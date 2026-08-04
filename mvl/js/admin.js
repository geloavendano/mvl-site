const cfg = window.MVL_SUPABASE;
const authClient = window.supabase.createClient(cfg.url, cfg.anonKey);
let session = null;
let data;
let activeAdminDay = 1;
let readinessRequest = 0;
const readinessTeamFilter = document.getElementById('readinessTeamFilter');
const readinessDayFilter = document.getElementById('readinessDayFilter');
const readinessTeamSummary = document.getElementById('readinessTeamSummary');
const readinessSummary = document.getElementById('readinessSummary');
const readinessTable = document.getElementById('readinessTable');
const unmatchedCheckins = document.getElementById('unmatchedCheckins');
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
        return `<tr>
          <td class="admin-player-name"><strong>${escapeHtml(player.name)}</strong><span>${player.jerseyNumber ? `#${escapeHtml(player.jerseyNumber)}` : 'No jersey number'}</span></td>
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
    form.isLive.checked = live.is_live; form.youtubeUrl.value = live.youtube_url || '';
    render();
    await loadReadiness();
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
