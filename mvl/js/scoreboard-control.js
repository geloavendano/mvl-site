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
const gameSelect = document.getElementById('gameSelect');
const currentSetSelect = document.getElementById('currentSetSelect');
const saveSetBtn = document.getElementById('saveSetBtn');
const savedSets = document.getElementById('savedSets');
let actionQueue = Promise.resolve();
let teamChangeTimer;
let currentBoard = null;

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
  currentBoard = board;
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
  gameSelect.value = board.game?.id || '';
  currentSetSelect.value = String(board.currentSet || 1);
  [...currentSetSelect.options].forEach((option) => {
    option.disabled = Boolean(board.game) && Number(option.value) > (board.game.maxSets || 5);
  });
  leftTeamSelect.disabled = Boolean(board.game);
  rightTeamSelect.disabled = Boolean(board.game);
  currentSetSelect.disabled = !board.game;
  saveSetBtn.disabled = !board.game;
  saveSetBtn.textContent = board.game ? `Save Set ${board.currentSet} score` : 'Save set score';
  document.querySelectorAll('.sets-control>span').forEach((label) => {
    label.textContent = board.game ? 'Saved sets' : 'Set wins';
  });
  document.querySelectorAll('[data-action$="set-add"],[data-action$="set-subtract"]').forEach((button) => {
    button.disabled = Boolean(board.game);
  });
  savedSets.innerHTML = board.savedSets?.length
    ? board.savedSets.map((set) => `<button type="button" data-edit-set="${set.setNumber}"><span>Set ${set.setNumber}</span><strong>${set.leftScore}–${set.rightScore}</strong></button>`).join('')
    : '<span>No set scores saved yet.</span>';
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
  if (currentBoard?.game) return;
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
const chooseGame = async () => {
  setStatus('Linking game…');
  try {
    render(await rpc('mvl_scoreboard_set_game', {
      ...credentials,
      p_game_id: gameSelect.value || null,
    }));
    setStatus(gameSelect.value ? 'Game linked. Scores will save to its record.' : 'Game link removed.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    await refresh();
  }
};
const chooseSet = async (setNumber) => {
  if (!currentBoard?.game) return;
  setStatus(`Loading Set ${setNumber}…`);
  try {
    render(await rpc('mvl_scoreboard_set_current_set', {
      ...credentials,
      p_set_number: Number(setNumber),
    }));
    setStatus(`Set ${setNumber} ready`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
};
const saveCurrentSet = async () => {
  if (!currentBoard?.game) return;
  const setNumber = currentBoard.currentSet;
  if (currentBoard.leftScore === currentBoard.rightScore) {
    setStatus('A completed set cannot have a tied score.', 'error');
    return;
  }
  saveSetBtn.disabled = true;
  setStatus(`Saving Set ${setNumber} to the game…`);
  try {
    render(await rpc('mvl_scoreboard_save_set', credentials));
    setStatus(`Set ${setNumber} saved to the game record`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    saveSetBtn.disabled = !currentBoard?.game;
  }
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
const copyCourtLink = async () => {
  const publicCode = currentBoard?.publicCode || boardId;
  const origin = window.location.hostname === 'www.metaricevolley.ph' ? 'https://metaricevolley.ph' : window.location.origin;
  const url = `${origin}/mvl/scoreboard-court?board=${encodeURIComponent(publicCode)}`;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Court link copied', 'success');
  } catch {
    window.prompt('Copy this court display link:', url);
  }
};

const teamOptions = window.MVL_DATA.teams.map((team) => `<option value="${team.id}">${team.name}</option>`).join('');
leftTeamSelect.innerHTML = teamOptions;
rightTeamSelect.innerHTML = teamOptions;
const formatGame = (game) => {
  const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(game.startsAt));
  return `${date} · ${game.court} · ${game.teamAName} vs ${game.teamBName}`;
};
const loadGames = async () => {
  const games = await rpc('mvl_scoreboard_get_games', credentials);
  gameSelect.replaceChildren(new Option('No game attached', ''));
  const dayGroups = new Map();
  games.forEach((game) => {
    if (!dayGroups.has(game.day)) dayGroups.set(game.day, []);
    dayGroups.get(game.day).push(game);
  });
  dayGroups.forEach((dayGames, day) => {
    const group = document.createElement('optgroup');
    group.label = `Day ${day}`;
    dayGames.forEach((game) => group.append(new Option(formatGame(game), game.id)));
    gameSelect.append(group);
  });
  if (currentBoard?.game) gameSelect.value = currentBoard.game.id;
};
document.querySelector('.control-scoreboard').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) runAction(button.dataset.action);
});
leftTeamSelect.addEventListener('change', saveTeams);
rightTeamSelect.addEventListener('change', saveTeams);
gameSelect.addEventListener('change', chooseGame);
currentSetSelect.addEventListener('change', () => chooseSet(currentSetSelect.value));
saveSetBtn.addEventListener('click', saveCurrentSet);
savedSets.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-set]');
  if (button) chooseSet(button.dataset.editSet);
});
document.getElementById('switchSidesBtn').addEventListener('click', () => runAction('switch-sides'));
document.getElementById('resetScoresBtn').addEventListener('click', () => {
  if (window.confirm('Reset both scores to zero? Set wins will stay unchanged.')) runAction('reset-scores');
});
document.getElementById('copyObsBtn').addEventListener('click', copyObsLink);
document.getElementById('copyCourtBtn').addEventListener('click', copyCourtLink);

refresh(true).then(loadGames).catch(showError);
window.setInterval(() => refresh(false), 900);
