const config = window.MVL_SUPABASE;
const boardId = new URLSearchParams(window.location.search).get('board');
const boardElement = document.getElementById('scoreboard');
const overlayStatus = document.getElementById('overlayStatus');
let lastUpdate = '';

const elements = {
  leftName: document.getElementById('leftName'),
  rightName: document.getElementById('rightName'),
  leftScore: document.getElementById('leftScore'),
  rightScore: document.getElementById('rightScore'),
  leftSets: document.getElementById('leftSets'),
  rightSets: document.getElementById('rightSets'),
  leftService: document.getElementById('leftService'),
  rightService: document.getElementById('rightService'),
};

const rpc = async (name, body) => {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Scoreboard unavailable');
  return result;
};

const applyTeam = (side, team) => {
  const box = document.querySelector(`.team-box--${side}`);
  const score = document.querySelector(`.score-box--${side}`);
  [box, score].forEach((element) => {
    element.style.setProperty('--team-a', team.colorA);
    element.style.setProperty('--team-b', team.colorB);
  });
};

const render = (board) => {
  if (lastUpdate === board.updatedAt) return;
  lastUpdate = board.updatedAt;
  elements.leftName.textContent = board.leftTeam.name;
  elements.rightName.textContent = board.rightTeam.name;
  elements.leftScore.textContent = board.leftScore;
  elements.rightScore.textContent = board.rightScore;
  elements.leftSets.textContent = board.leftSets;
  elements.rightSets.textContent = board.rightSets;
  elements.leftService.classList.toggle('is-serving', board.servingSide === 'left');
  elements.rightService.classList.toggle('is-serving', board.servingSide === 'right');
  applyTeam('left', board.leftTeam);
  applyTeam('right', board.rightTeam);
  document.title = `${board.name} · MVL Scoreboard`;
  boardElement.classList.remove('is-loading');
  overlayStatus.className = 'overlay-status is-hidden';
};

const refresh = async () => {
  if (!boardId) {
    overlayStatus.textContent = 'Missing scoreboard link';
    overlayStatus.className = 'overlay-status is-error';
    return;
  }
  try {
    render(await rpc('mvl_get_scoreboard', { p_scoreboard_id: boardId }));
  } catch (error) {
    overlayStatus.textContent = error.message;
    overlayStatus.className = 'overlay-status is-error';
  }
};

refresh();
window.setInterval(refresh, 500);
