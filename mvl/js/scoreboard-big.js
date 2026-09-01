/* ==========================================================================
   Big score overlay — every set, both teams, one band.

   Same data and the same 500ms poll as the OBS overlay (scoreboard.js); what
   differs is the shape: that one shows the running set, this one shows the
   whole match. Both read mvl_get_scoreboard, which already returns savedSets,
   so nothing was added server-side.
   ========================================================================== */
const config = window.MVL_SUPABASE;
const boardId = new URLSearchParams(window.location.search).get('board');
const boardElement = document.getElementById('bigscore');
const status = document.getElementById('bigscoreStatus');
const leftName = document.getElementById('bigLeftName');
const rightName = document.getElementById('bigRightName');
const leftSets = document.getElementById('bigLeftSets');
const rightSets = document.getElementById('bigRightSets');
let lastUpdate = '';

const rpc = async (name, body) => {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    cache: 'no-store',
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

// Completed sets come from savedSets; the set in progress is not saved until
// the operator closes it, so it is appended from the live score. Without that
// the band would sit a whole set behind what the crowd is watching.
const setColumns = (board) => {
  const saved = (board.savedSets || []).map((set) => ({
    number: set.setNumber,
    left: set.leftScore ?? 0,
    right: set.rightScore ?? 0,
    live: false,
  }));
  const current = Number(board.currentSet) || saved.length + 1;
  if (!saved.some((set) => set.number === current)) {
    saved.push({ number: current, left: board.leftScore ?? 0, right: board.rightScore ?? 0, live: true });
  }
  return saved.sort((a, b) => a.number - b.number);
};

const renderSets = (columns) => {
  const cell = (column, side) => {
    const mine = side === 'left' ? column.left : column.right;
    const theirs = side === 'left' ? column.right : column.left;
    // a live set has no winner yet — highlighting one mid-rally would read as
    // a decided result on the broadcast
    const won = !column.live && mine > theirs;
    return `<span class="bigscore-set${won ? ' is-won' : ''}${column.live ? ' is-live' : ''}">${mine}</span>`;
  };
  leftSets.innerHTML = columns.map((column) => cell(column, 'left')).join('');
  rightSets.innerHTML = columns.map((column) => cell(column, 'right')).join('');
  boardElement.style.setProperty('--set-count', String(columns.length));
};

const applyTeam = (row, team) => {
  row.style.setProperty('--team-a', team.colorA);
  row.style.setProperty('--team-b', team.colorB);
};

// Long names would otherwise push the set columns off the overlay.
const fitName = (element) => {
  element.style.fontSize = '';
  const available = element.clientWidth;
  const required = element.scrollWidth;
  if (!available || !required || required <= available) return;
  const base = Number.parseFloat(getComputedStyle(element).fontSize);
  element.style.fontSize = `${Math.max(18, Math.floor(base * (available / required) * 0.96))}px`;
};
const fitNames = () => { fitName(leftName); fitName(rightName); };

const render = (board) => {
  if (lastUpdate === board.updatedAt) return;
  lastUpdate = board.updatedAt;
  leftName.textContent = board.leftTeam.name;
  rightName.textContent = board.rightTeam.name;
  applyTeam(document.querySelector('.bigscore-row--left'), board.leftTeam);
  applyTeam(document.querySelector('.bigscore-row--right'), board.rightTeam);
  renderSets(setColumns(board));
  window.requestAnimationFrame(fitNames);
  document.title = `${board.name} · MVL Big Score`;
  boardElement.classList.remove('is-loading');
  status.className = 'overlay-status is-hidden';
};

const refresh = async () => {
  if (!boardId) {
    status.textContent = 'Missing scoreboard link';
    status.className = 'overlay-status is-error';
    return;
  }
  try {
    render(await rpc('mvl_get_scoreboard', { p_scoreboard_id: boardId }));
  } catch (error) {
    status.textContent = error.message;
    status.className = 'overlay-status is-error';
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
