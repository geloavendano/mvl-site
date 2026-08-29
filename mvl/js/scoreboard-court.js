const config = window.MVL_SUPABASE;
const boardId = new URLSearchParams(window.location.search).get('board');
const scoreboard = document.getElementById('courtScoreboard');
const statusElement = document.getElementById('courtStatus');
const setScores = document.getElementById('setScores');
let lastUpdate = '';

const elements = {
  boardName: document.getElementById('boardName'),
  gameContext: document.getElementById('gameContext'),
  currentSetLabel: document.getElementById('currentSetLabel'),
  leftPanel: document.getElementById('leftTeamPanel'),
  rightPanel: document.getElementById('rightTeamPanel'),
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
    method: 'POST', cache: 'no-store',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Scoreboard unavailable');
  return result;
};

const styleTeam = (panel, team) => {
  panel.style.setProperty('--team-a', team.colorA);
  panel.style.setProperty('--team-b', team.colorB);
};

const fitName = (element) => {
  element.style.fontSize = '';
  if (!element.clientWidth || element.scrollWidth <= element.clientWidth) return;
  const baseSize = Number.parseFloat(getComputedStyle(element).fontSize);
  element.style.fontSize = `${Math.max(24, Math.floor(baseSize * element.clientWidth / element.scrollWidth * .94))}px`;
};
const fitNames = () => {
  fitName(elements.leftName);
  fitName(elements.rightName);
};

const renderSetScores = (board) => {
  const saved = new Map((board.savedSets || []).map((set) => [Number(set.setNumber), set]));
  const maxSets = board.game?.maxSets || Math.max(3, Number(board.currentSet) || 1);
  setScores.innerHTML = Array.from({ length: maxSets }, (_, index) => {
    const setNumber = index + 1;
    const recorded = saved.get(setNumber);
    const isCurrent = setNumber === Number(board.currentSet);
    const left = isCurrent ? board.leftScore : recorded?.leftScore;
    const right = isCurrent ? board.rightScore : recorded?.rightScore;
    const hasScore = left !== undefined && right !== undefined;
    return `<div class="court-set-chip${isCurrent ? ' is-current' : ''}">
      <span>Set ${setNumber}${isCurrent ? ' · Live' : ''}</span>
      <strong>${hasScore ? `${left}<i>–</i>${right}` : '<i>—</i>'}</strong>
    </div>`;
  }).join('');
};

const render = (board) => {
  if (lastUpdate === board.updatedAt) return;
  lastUpdate = board.updatedAt;
  elements.boardName.textContent = board.name;
  elements.currentSetLabel.textContent = `Set ${board.currentSet || 1}`;
  elements.gameContext.textContent = board.game ? `Day ${board.game.day} · ${board.game.court}` : 'Live court scoreboard';
  elements.leftName.textContent = board.leftTeam.name;
  elements.rightName.textContent = board.rightTeam.name;
  elements.leftScore.textContent = board.leftScore;
  elements.rightScore.textContent = board.rightScore;
  elements.leftSets.textContent = board.leftSets;
  elements.rightSets.textContent = board.rightSets;
  elements.leftService.classList.toggle('is-serving', board.servingSide === 'left');
  elements.rightService.classList.toggle('is-serving', board.servingSide === 'right');
  styleTeam(elements.leftPanel, board.leftTeam);
  styleTeam(elements.rightPanel, board.rightTeam);
  renderSetScores(board);
  scoreboard.classList.remove('is-loading');
  statusElement.classList.add('is-hidden');
  document.title = `${board.name} · MVL Court Scoreboard`;
  window.requestAnimationFrame(fitNames);
};

const refresh = async () => {
  if (!boardId) {
    statusElement.textContent = 'Missing scoreboard link';
    statusElement.classList.add('is-error');
    return;
  }
  try {
    render(await rpc('mvl_get_scoreboard', { p_scoreboard_id: boardId }));
  } catch (error) {
    statusElement.textContent = error.message;
    statusElement.classList.add('is-error');
    statusElement.classList.remove('is-hidden');
  }
};

refresh();
window.setInterval(refresh, 500);
document.fonts?.ready.then(fitNames);
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(fitNames, 80);
});
