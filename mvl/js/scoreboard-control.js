const config = window.MVL_SUPABASE;
const params = new URLSearchParams(window.location.search);
const boardId = params.get('board');
const controlToken = params.get('key');
const controlApp = document.getElementById('controlApp');
const controlError = document.getElementById('controlError');
const controlErrorMessage = document.getElementById('controlErrorMessage');
const controlStatus = document.getElementById('controlStatus');
const connectionState = document.getElementById('connectionState');
const leftTeamSelect = document.getElementById('leftTeamSelect');
const rightTeamSelect = document.getElementById('rightTeamSelect');
let actionQueue = Promise.resolve();
let teamChangeTimer;

const elements = {
  boardName: document.getElementById('boardName'),
  leftPanel: document.getElementById('leftTeamPanel'),
  rightPanel: document.getElementById('rightTeamPanel'),
  leftName: document.getElementById('leftTeamName'),
  rightName: document.getElementById('rightTeamName'),
  leftScore: document.getElementById('leftScore'),
  rightScore: document.getElementById('rightScore'),
  leftSets: document.getElementById('leftSets'),
  rightSets: document.getElementById('rightSets'),
  leftService: document.getElementById('leftService'),
  rightService: document.getElementById('rightService'),
};

const rpc = async (name, body) => {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Request failed');
  return result;
};

const setStatus = (message = '', type = '') => {
  controlStatus.textContent = message;
  controlStatus.className = `control-status${type ? ` is-${type}` : ''}`;
};
const setConnected = (connected) => {
  connectionState.textContent = connected ? 'Live' : 'Offline';
  connectionState.classList.toggle('is-error', !connected);
};
const stylePanel = (panel, team) => {
  panel.style.setProperty('--team-a', team.colorA);
  panel.style.setProperty('--team-b', team.colorB);
};
const render = (board) => {
  elements.boardName.textContent = board.name;
  elements.leftName.textContent = board.leftTeam.name;
  elements.rightName.textContent = board.rightTeam.name;
  elements.leftScore.textContent = board.leftScore;
  elements.rightScore.textContent = board.rightScore;
  elements.leftSets.textContent = board.leftSets;
  elements.rightSets.textContent = board.rightSets;
  elements.leftService.classList.toggle('is-serving', board.servingSide === 'left');
  elements.rightService.classList.toggle('is-serving', board.servingSide === 'right');
  leftTeamSelect.value = board.leftTeam.id;
  rightTeamSelect.value = board.rightTeam.id;
  stylePanel(elements.leftPanel, board.leftTeam);
  stylePanel(elements.rightPanel, board.rightTeam);
  document.title = `${board.name} · Scoreboard Control`;
  controlApp.classList.remove('is-loading');
  setConnected(true);
};
const showError = (error) => {
  controlErrorMessage.textContent = error.message;
  controlError.classList.remove('is-hidden');
  controlApp.classList.add('is-hidden');
  setConnected(false);
};
const credentials = { p_scoreboard_id: boardId, p_control_token: controlToken };

const refresh = async (initial = false) => {
  if (!boardId || !controlToken) {
    showError(new Error('This control URL is incomplete. Ask an MVL admin to copy the control link again.'));
    return;
  }
  try {
    render(await rpc('mvl_scoreboard_get_control', credentials));
    if (initial) controlError.classList.add('is-hidden');
  } catch (error) {
    if (initial) showError(error);
    else setConnected(false);
  }
};
const runAction = (action) => {
  setStatus('Updating…');
  actionQueue = actionQueue.then(async () => {
    try {
      render(await rpc('mvl_scoreboard_control', { ...credentials, p_action: action }));
      setStatus('Updated', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
      setConnected(false);
    }
  });
};
const saveTeams = () => {
  window.clearTimeout(teamChangeTimer);
  const leftTeam = leftTeamSelect.value;
  const rightTeam = rightTeamSelect.value;
  teamChangeTimer = window.setTimeout(async () => {
    if (leftTeam === rightTeam) {
      setStatus('Choose two different teams.', 'error');
      await refresh();
      return;
    }
    setStatus('Changing teams…');
    try {
      render(await rpc('mvl_scoreboard_set_teams', {
        ...credentials,
        p_team_left_id: leftTeam,
        p_team_right_id: rightTeam,
      }));
      setStatus('Teams updated', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
      await refresh();
    }
  }, 180);
};
const copyObsLink = async () => {
  const url = `${window.location.origin}/mvl/scoreboard?board=${encodeURIComponent(boardId)}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('OBS link copied', 'success');
  } catch {
    window.prompt('Copy this OBS link:', url);
  }
};

const teamOptions = window.MVL_DATA.teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join('');
leftTeamSelect.innerHTML = teamOptions;
rightTeamSelect.innerHTML = teamOptions;
document.querySelector('.control-scoreboard').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) runAction(button.dataset.action);
});
leftTeamSelect.addEventListener('change', saveTeams);
rightTeamSelect.addEventListener('change', saveTeams);
document.getElementById('switchSidesBtn').addEventListener('click', () => runAction('switch-sides'));
document.getElementById('resetScoresBtn').addEventListener('click', () => {
  if (window.confirm('Reset both scores to zero? Set wins will stay unchanged.')) runAction('reset-scores');
});
document.getElementById('copyObsBtn').addEventListener('click', copyObsLink);

refresh(true);
window.setInterval(() => refresh(false), 900);
