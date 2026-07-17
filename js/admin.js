const cfg = window.MVL_SUPABASE;
const authClient = window.supabase.createClient(cfg.url, cfg.anonKey);
let session = null;
let data;
const teams = Object.fromEntries(window.MVL_DATA.teams.map((t) => [t.id, t]));
const status = (el, text, type = '') => { el.textContent = text; el.className = `form-status ${type ? `is-${type}` : ''}`; };
const call = async (path, body, token = session?.access_token) => {
  const res = await fetch(`${cfg.url}${path}`, { method: 'POST', headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token || cfg.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error_description || 'Request failed');
  return json;
};
const rpc = (name, body) => call(`/rest/v1/rpc/${name}`, body);
const duration = (value) => value ? value.split(':').map(Number).reduce((sum, n) => sum * 60 + n, 0) : null;
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
const manilaDateTime = (iso) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(iso)).replace(' ', 'T');
const teamOptions = (selected) => window.MVL_DATA.teams.map((team) =>
  `<option value="${team.id}" ${team.id === selected ? 'selected' : ''}>${team.name}</option>`
).join('');
const render = () => {
  document.getElementById('adminGameList').innerHTML = data.publicData.games.map((g) => `<form class="admin-panel admin-game admin-form" data-id="${g.id}">
    <div class="admin-panel-head"><div><p class="games-label">Day ${g.day} · ${g.status}</p><h3>${teams[g.teamA].name} <em>vs</em> ${teams[g.teamB].name}</h3></div><button type="button" class="admin-link" data-reset>Reset</button></div>
    <div class="admin-fields admin-fields--matchup"><label class="field"><span>Team A</span><select name="teamA">${teamOptions(g.teamA)}</select></label><label class="field"><span>Team B</span><select name="teamB">${teamOptions(g.teamB)}</select></label><label class="field"><span>Match day</span><input name="day" type="number" min="1" value="${g.day}" required></label><label class="field"><span>Game order</span><input name="gameOrder" type="number" min="1" value="${g.gameOrder || 1}" required><small>Lower numbers appear first.</small></label><label class="field"><span>Date & time (Philippines)</span><input name="startsAt" type="datetime-local" value="${manilaDateTime(g.startsAt)}" required></label><button class="cta cta--secondary" type="button" data-save-schedule>Save schedule & matchup</button></div>
    <p class="admin-warning">Changing either team clears the old result, set scores, and video because they belong to the previous matchup.</p>
    <div class="admin-fields admin-fields--three"><label class="field"><span>Winner</span><select name="winner" required><option value="">Choose</option><option value="${g.teamA}" ${g.winner === g.teamA ? 'selected' : ''}>${teams[g.teamA].name}</option><option value="${g.teamB}" ${g.winner === g.teamB ? 'selected' : ''}>${teams[g.teamB].name}</option></select></label><label class="field"><span>YouTube link or video ID</span><input name="youtubeId" value="${g.youtubeId || ''}" placeholder="https://youtu.be/... or video ID"><small>The video ID is the code after youtu.be/ or v=; a full link also works.</small></label><label class="field"><span>Duration H:MM:SS</span><input name="duration" value="${g.duration || ''}"></label></div>
    <div class="admin-score-heading"><span>Set</span><strong>${teams[g.teamA].name}</strong><strong>${teams[g.teamB].name}</strong></div>
    <div class="admin-sets">${[0,1,2,3,4].map((i) => `<label><span>Set ${i+1}</span><input name="a${i}" aria-label="${teams[g.teamA].name} set ${i+1}" type="number" min="0" value="${g.sets[i]?.a ?? ''}"><input name="b${i}" aria-label="${teams[g.teamB].name} set ${i+1}" type="number" min="0" value="${g.sets[i]?.b ?? ''}"></label>`).join('')}</div>
    <button class="cta cta--primary">Save result & video</button><p class="form-status"></p></form>`).join('');
};
const show = async () => {
  try {
    data = await rpc('mvl_admin_get_dashboard');
    loginPanel.classList.add('is-hidden'); dashboard.classList.remove('is-hidden'); signOutBtn.classList.remove('is-hidden');
    adminIdentity.textContent = data.email;
    const live = data.publicData.livestream, form = livestreamForm.elements;
    form.isLive.checked = live.is_live; form.youtubeUrl.value = live.youtube_url || ''; form.youtubeId.value = live.youtube_id || '';
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
livestreamForm.addEventListener('submit', async (e) => { e.preventDefault(); const s = e.target.querySelector('.form-status'), f = e.target.elements; status(s, 'Saving…'); try { const id = youtubeId(f.youtubeId.value) || youtubeId(f.youtubeUrl.value) || ''; await rpc('mvl_admin_update_livestream', { p_is_live: f.isLive.checked, p_youtube_url: f.youtubeUrl.value, p_youtube_id: id }); f.youtubeId.value = id; status(s, 'Livestream updated.', 'success'); } catch (err) { status(s, err.message, 'error'); } });
adminGameList.addEventListener('submit', async (e) => { const form = e.target.closest('[data-id]'); if (!form) return; e.preventDefault(); const s = form.querySelector('.form-status'), g = data.publicData.games.find((x) => x.id === form.dataset.id); const sets = [0,1,2,3,4].filter((i) => form.elements[`a${i}`].value !== '' && form.elements[`b${i}`].value !== '').map((i) => ({ team_a_score: +form.elements[`a${i}`].value, team_b_score: +form.elements[`b${i}`].value })); status(s, 'Saving…'); try { if (!sets.length) throw new Error('Enter at least one set.'); await rpc('mvl_record_game_result', { p_game_id:g.id,p_winner_team_id:form.elements.winner.value,p_player_of_game_id:null,p_sets:sets,p_youtube_id:youtubeId(form.elements.youtubeId.value),p_video_title:`${teams[g.teamA].name} vs ${teams[g.teamB].name} · Full Game`,p_duration_seconds:duration(form.elements.duration.value),p_video_published_at:new Date().toISOString(),p_video_is_featured:true }); status(s,'Result and video updated.','success'); } catch(err){ status(s,err.message,'error'); } });
adminGameList.addEventListener('click', async (e) => { const form=e.target.closest('[data-id]'); if(!form)return; const s=form.querySelector('.form-status'); if(e.target.closest('[data-save-schedule]')){status(s,'Saving schedule and matchup…');try{const local=form.elements.startsAt.value;const updated=await rpc('mvl_admin_update_game_schedule',{p_game_id:form.dataset.id,p_day:+form.elements.day.value,p_game_order:+form.elements.gameOrder.value,p_starts_at:new Date(`${local}:00+08:00`).toISOString(),p_team_a_id:form.elements.teamA.value,p_team_b_id:form.elements.teamB.value});const game=data.publicData.games.find((item)=>item.id===form.dataset.id);Object.assign(game,{day:updated.day,gameOrder:updated.gameOrder,startsAt:updated.startsAt,teamA:updated.teamA,teamB:updated.teamB});status(s,updated.matchupChanged?'Matchup updated; old result and video cleared.':'Schedule and order updated.','success');}catch(err){status(s,err.message,'error');}return;} const btn=e.target.closest('[data-reset]'); if(!btn)return; status(s,'Resetting…'); try{await rpc('mvl_admin_reset_game',{p_game_id:form.dataset.id});form.elements.winner.value='';form.querySelectorAll('.admin-sets input').forEach((i)=>i.value='');status(s,'Reset to pending.','success');}catch(err){status(s,err.message,'error');}});
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
