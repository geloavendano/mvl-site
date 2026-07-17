const cfg = window.MVL_SUPABASE;
const key = 'mvl_admin_session';
let session = JSON.parse(localStorage.getItem(key) || 'null');
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
const render = () => {
  document.getElementById('adminGameList').innerHTML = data.publicData.games.map((g) => `<form class="admin-panel admin-game admin-form" data-id="${g.id}">
    <div class="admin-panel-head"><div><p class="games-label">Day ${g.day} · ${g.status}</p><h3>${teams[g.teamA].name} <em>vs</em> ${teams[g.teamB].name}</h3></div><button type="button" class="admin-link" data-reset>Reset</button></div>
    <div class="admin-fields admin-fields--three"><label class="field"><span>Winner</span><select name="winner" required><option value="">Choose</option><option value="${g.teamA}" ${g.winner === g.teamA ? 'selected' : ''}>${teams[g.teamA].name}</option><option value="${g.teamB}" ${g.winner === g.teamB ? 'selected' : ''}>${teams[g.teamB].name}</option></select></label><label class="field"><span>YouTube ID</span><input name="youtubeId" value="${g.youtubeId || ''}"></label><label class="field"><span>Duration H:MM:SS</span><input name="duration" value="${g.duration || ''}"></label></div>
    <div class="admin-sets">${[0,1,2,3,4].map((i) => `<label><span>Set ${i+1}</span><input name="a${i}" type="number" min="0" value="${g.sets[i]?.a ?? ''}"><b>–</b><input name="b${i}" type="number" min="0" value="${g.sets[i]?.b ?? ''}"></label>`).join('')}</div>
    <button class="cta cta--primary">Save result</button><p class="form-status"></p></form>`).join('');
};
const show = async () => {
  try {
    data = await rpc('mvl_admin_get_dashboard');
    loginPanel.classList.add('is-hidden'); dashboard.classList.remove('is-hidden'); signOutBtn.classList.remove('is-hidden');
    adminIdentity.textContent = data.email;
    const live = data.publicData.livestream, form = livestreamForm.elements;
    form.isLive.checked = live.is_live; form.youtubeUrl.value = live.youtube_url || ''; form.youtubeId.value = live.youtube_id || '';
    render();
  } catch (e) { localStorage.removeItem(key); status(loginStatus, e.message, 'error'); }
};
loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const f = new FormData(e.target); status(loginStatus, 'Signing in…'); try { session = await call('/auth/v1/token?grant_type=password', { email: f.get('email'), password: f.get('password') }, cfg.anonKey); localStorage.setItem(key, JSON.stringify(session)); show(); } catch (err) { status(loginStatus, err.message, 'error'); } });
livestreamForm.addEventListener('submit', async (e) => { e.preventDefault(); const s = e.target.querySelector('.form-status'), f = e.target.elements; status(s, 'Saving…'); try { await rpc('mvl_admin_update_livestream', { p_is_live: f.isLive.checked, p_youtube_url: f.youtubeUrl.value, p_youtube_id: f.youtubeId.value }); status(s, 'Livestream updated.', 'success'); } catch (err) { status(s, err.message, 'error'); } });
adminGameList.addEventListener('submit', async (e) => { const form = e.target.closest('[data-id]'); if (!form) return; e.preventDefault(); const s = form.querySelector('.form-status'), g = data.publicData.games.find((x) => x.id === form.dataset.id); const sets = [0,1,2,3,4].filter((i) => form.elements[`a${i}`].value !== '' && form.elements[`b${i}`].value !== '').map((i) => ({ team_a_score: +form.elements[`a${i}`].value, team_b_score: +form.elements[`b${i}`].value })); status(s, 'Saving…'); try { if (!sets.length) throw new Error('Enter at least one set.'); await rpc('mvl_record_game_result', { p_game_id:g.id,p_winner_team_id:form.elements.winner.value,p_player_of_game_id:null,p_sets:sets,p_youtube_id:form.elements.youtubeId.value||null,p_video_title:`${teams[g.teamA].name} vs ${teams[g.teamB].name} · Full Game`,p_duration_seconds:duration(form.elements.duration.value),p_video_published_at:new Date().toISOString(),p_video_is_featured:true }); status(s,'Result updated.','success'); } catch(err){ status(s,err.message,'error'); } });
adminGameList.addEventListener('click', async (e) => { const btn=e.target.closest('[data-reset]'); if(!btn)return; const form=btn.closest('[data-id]'),s=form.querySelector('.form-status'); status(s,'Resetting…'); try{await rpc('mvl_admin_reset_game',{p_game_id:form.dataset.id});form.elements.winner.value='';form.querySelectorAll('.admin-sets input').forEach((i)=>i.value='');status(s,'Reset to pending.','success');}catch(err){status(s,err.message,'error');}});
signOutBtn.addEventListener('click',()=>{localStorage.removeItem(key);location.reload();});
if(session?.access_token)show();
