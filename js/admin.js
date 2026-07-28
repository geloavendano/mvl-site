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
    <div class="admin-result-fields"><label class="field"><span>Winner</span><select name="winner" required ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><option value="">Choose winner</option><option value="${g.teamA}" ${g.winner === g.teamA ? 'selected' : ''}>${gameTeamName(g, 'A')}</option><option value="${g.teamB}" ${g.winner === g.teamB ? 'selected' : ''}>${gameTeamName(g, 'B')}</option></select></label><label class="field"><span>YouTube link</span><input name="youtubeUrl" type="url" value="${g.youtubeId ? `https://www.youtube.com/watch?v=${g.youtubeId}` : ''}" placeholder="https://youtube.com/watch?v=..."></label></div>
    <div class="admin-score-heading"><span>Set</span><strong>${gameTeamName(g, 'A')}</strong><strong>${gameTeamName(g, 'B')}</strong></div>
    <div class="admin-sets">${Array.from({ length: setCount }, (_, i) => `<label><span>Set ${i+1}</span><input name="a${i}" aria-label="${gameTeamName(g, 'A')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.a ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}><input name="b${i}" aria-label="${gameTeamName(g, 'B')} set ${i+1}" type="number" min="0" value="${g.sets[i]?.b ?? ''}" ${g.teamALabel || g.teamBLabel ? 'disabled' : ''}></label>`).join('')}</div>
    <button class="cta cta--primary" ${g.teamALabel || g.teamBLabel ? 'disabled title="The teams will be assigned automatically from tournament results."' : ''}>Save result & video</button><p class="form-status"></p></form>`;
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
    options: { redirectTo: `${window.location.origin}/admin` },
  });
  if (error) status(loginStatus, error.message, 'error');
});
livestreamForm.addEventListener('submit', async (e) => { e.preventDefault(); const s = e.target.querySelector('.form-status'), f = e.target.elements; status(s, 'Saving…'); try { const id = youtubeId(f.youtubeUrl.value) || ''; await rpc('mvl_admin_update_livestream', { p_is_live: f.isLive.checked, p_youtube_url: f.youtubeUrl.value, p_youtube_id: id }); status(s, 'Livestream updated.', 'success'); } catch (err) { status(s, err.message, 'error'); } });
adminDayFilter.addEventListener('change', () => { activeAdminDay = Number(adminDayFilter.value); render(); });
adminGameList.addEventListener('submit', async (e) => { const form = e.target.closest('[data-id]'); if (!form) return; e.preventDefault(); const s = form.querySelector('.form-status'), g = data.publicData.games.find((x) => x.id === form.dataset.id); const setCount=g.id.startsWith('pre-')?3:5;const sets=Array.from({length:setCount},(_,i)=>i).filter((i) => form.elements[`a${i}`].value !== '' && form.elements[`b${i}`].value !== '').map((i) => ({ team_a_score: +form.elements[`a${i}`].value, team_b_score: +form.elements[`b${i}`].value })); status(s, 'Saving…'); try { if (!sets.length) throw new Error('Enter at least one set.'); await rpc('mvl_record_game_result', { p_game_id:g.id,p_winner_team_id:form.elements.winner.value,p_player_of_game_id:null,p_sets:sets,p_youtube_id:youtubeId(form.elements.youtubeUrl.value),p_video_title:`${gameTeamName(g, 'A')} vs ${gameTeamName(g, 'B')} · Full Game`,p_duration_seconds:null,p_video_published_at:new Date().toISOString(),p_video_is_featured:true });data=await rpc('mvl_admin_get_dashboard');render();const refreshed=document.querySelector(`[data-id="${g.id}"] .form-status`);status(refreshed,'Result and video updated.','success'); } catch(err){ status(s,err.message,'error'); } });
adminGameList.addEventListener('click', async (e) => { const btn=e.target.closest('[data-reset]'); if(!btn)return; const form=btn.closest('[data-id]'),s=form.querySelector('.form-status'); status(s,'Resetting…'); try{await rpc('mvl_admin_reset_game',{p_game_id:form.dataset.id});form.elements.winner.value='';form.querySelectorAll('.admin-sets input').forEach((i)=>i.value='');status(s,'Reset to pending.','success');}catch(err){status(s,err.message,'error');}});
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
