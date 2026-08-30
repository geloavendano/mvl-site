const { teams, games } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
const playoffGameIds = new Set(['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'bronze', 'final']);
const playoffNotes = {
  qf1: { round: 'Quarterfinal 1', matchup: '3rd vs 6th' },
  qf2: { round: 'Quarterfinal 2', matchup: '4th vs 5th' },
  qf3: { round: 'Quarterfinal 3', matchup: '2nd vs 7th' },
  qf4: { round: 'Quarterfinal 4', matchup: '1st vs 8th' },
  sf1: { round: 'Semifinal 1', matchup: 'Winner QF1 vs Winner QF4' },
  sf2: { round: 'Semifinal 2', matchup: 'Winner QF2 vs Winner QF3' },
  bronze: { round: 'Battle for Bronze', matchup: 'Loser SF1 vs Loser SF2' },
  final: { round: 'Championship Match', matchup: 'Winner SF1 vs Winner SF2' },
};
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));
const playerPhotoUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${window.MVL_SUPABASE.url}/storage/v1/object/public/mvl-player-photos/${path}`;
};
const gameTeam = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  return { ...(teamById[id] || { id, grad: ['#4338CA', '#16104A'] }), name: label || teamById[id]?.name || 'TBD' };
};

const formatTime = (iso) => new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
}).format(new Date(iso));

const formatDayDate = (iso) => new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Manila',
}).format(new Date(iso));

const setWinsFor = (game, teamId) => game.sets
  .filter((set) => (teamId === game.teamA ? set.a > set.b : set.b > set.a))
  .length;

const pointsFor = (game, teamId) => game.sets.reduce((sum, set) =>
  sum + (teamId === game.teamA ? set.a : set.b), 0);

const pointsAgainst = (game, teamId) => game.sets.reduce((sum, set) =>
  sum + (teamId === game.teamA ? set.b : set.a), 0);

const ratioValue = (forValue, againstValue) => {
  if (againstValue === 0) return forValue > 0 ? Number.POSITIVE_INFINITY : 0;
  return forValue / againstValue;
};

const buildStandings = () => {
  const rows = teams.map((team) => ({
    team,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    headToHeadWins: 0,
    headToHeadSetRatio: 0,
    headToHeadPointRatio: 0,
  }));
  const rowByTeam = Object.fromEntries(rows.map((row) => [row.team.id, row]));
  const finalGames = games.filter((game) => game.status === 'final' && !playoffGameIds.has(game.id));

  finalGames.forEach((game) => {
    const a = rowByTeam[game.teamA];
    const b = rowByTeam[game.teamB];
    const aSetWins = setWinsFor(game, game.teamA);
    const bSetWins = setWinsFor(game, game.teamB);

    a.setsWon += aSetWins;
    a.setsLost += bSetWins;
    b.setsWon += bSetWins;
    b.setsLost += aSetWins;
    a.pointsFor += pointsFor(game, game.teamA);
    a.pointsAgainst += pointsAgainst(game, game.teamA);
    b.pointsFor += pointsFor(game, game.teamB);
    b.pointsAgainst += pointsAgainst(game, game.teamB);

    if (game.winner === game.teamA) {
      a.wins += 1;
      b.losses += 1;
    } else if (game.winner === game.teamB) {
      b.wins += 1;
      a.losses += 1;
    }
  });

  rows.forEach((row) => {
    row.setRatio = ratioValue(row.setsWon, row.setsLost);
    row.pointRatio = ratioValue(row.pointsFor, row.pointsAgainst);
  });

  rows.forEach((row) => {
    const tiedTeams = rows
      .filter((other) =>
        other.team.id !== row.team.id &&
        other.wins === row.wins &&
        other.setRatio === row.setRatio &&
        other.pointRatio === row.pointRatio)
      .map((other) => other.team.id);

    if (!tiedTeams.length) return;

    let h2hSetsWon = 0;
    let h2hSetsLost = 0;
    let h2hPointsFor = 0;
    let h2hPointsAgainst = 0;

    finalGames
      .filter((game) =>
        [game.teamA, game.teamB].includes(row.team.id) &&
        tiedTeams.some((teamId) => [game.teamA, game.teamB].includes(teamId)))
      .forEach((game) => {
        if (game.winner === row.team.id) row.headToHeadWins += 1;
        h2hSetsWon += setWinsFor(game, row.team.id);
        h2hSetsLost += game.sets.length - setWinsFor(game, row.team.id);
        h2hPointsFor += pointsFor(game, row.team.id);
        h2hPointsAgainst += pointsAgainst(game, row.team.id);
      });

    row.headToHeadSetRatio = ratioValue(h2hSetsWon, h2hSetsLost);
    row.headToHeadPointRatio = ratioValue(h2hPointsFor, h2hPointsAgainst);
  });

  return rows.sort((a, b) => {
    return b.wins - a.wins ||
      b.setRatio - a.setRatio ||
      b.pointRatio - a.pointRatio ||
      b.headToHeadWins - a.headToHeadWins ||
      b.headToHeadSetRatio - a.headToHeadSetRatio ||
      b.headToHeadPointRatio - a.headToHeadPointRatio ||
      a.team.name.localeCompare(b.team.name);
  });
};

const standingsBody = document.getElementById('standingsBody');
standingsBody.innerHTML = buildStandings().map((row, i) => {
  const ratio = row.setsLost ? row.setRatio.toFixed(2) : (row.setsWon ? 'MAX' : '-');
  return `
    <tr>
      <td>${i + 1}</td>
      <td>
        <span class="standing-team-mark" style="--team-a:${row.team.grad[0]}; --team-b:${row.team.grad[1]}"></span>
        ${row.team.name}
      </td>
      <td>${row.wins}</td>
      <td>${row.losses}</td>
      <td>${row.setsWon}-${row.setsLost}</td>
      <td>${ratio}</td>
    </tr>
  `;
}).join('');

const days = [...new Set(games.map((game) => game.day))].sort((a, b) => a - b);
const dayDateByDay = Object.fromEntries(days.map((day) => {
  const firstGame = games
    .filter((game) => game.day === day)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  return [day, firstGame ? formatDayDate(firstGame.startsAt) : ''];
}));
const filterableTeams = teams
  .filter((team) => games.some((game) =>
    !game.teamALabel &&
    !game.teamBLabel &&
    [game.teamA, game.teamB].includes(team.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
// #day-2 in the URL opens that day directly, so a link from an email or a post
// can point at the day it is talking about. The tabs are rendered by JS and
// carry no ids, so the browser cannot resolve the fragment itself — dayFromHash
// reads it and the load-time scroll below does the jump the browser would.
const dayFromHash = () => {
  const found = /^#day-(\d+)$/.exec(window.location.hash || '');
  const day = found ? Number(found[1]) : NaN;
  return days.includes(day) ? day : null;
};

let activeDay = dayFromHash() ?? days[0];
let selectedTeamId = '';

const dayTabs = document.getElementById('dayTabs');
const matchList = document.getElementById('matchList');
const teamFilter = document.getElementById('teamFilter');

const renderTeamFilter = () => {
  if (!teamFilter) return;
  teamFilter.innerHTML = `
    <option value="">All teams</option>
    ${filterableTeams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('')}
  `;
};

const renderTabs = () => {
  dayTabs.innerHTML = days.map((day) => `
    <button class="day-tab ${day === activeDay ? 'is-active' : ''}" type="button" data-day="${day}" role="tab" aria-selected="${day === activeDay}">
      <span class="day-tab-label">Day ${day}</span>
      <span class="day-tab-date">${escapeHtml(dayDateByDay[day])}</span>
    </button>
  `).join('');
};

const scoreLine = (game, teamId) => {
  if (!game.sets.length) return '<span class="pending-score">Pending</span>';
  return game.sets.map((set) => {
    const score = teamId === game.teamA ? set.a : set.b;
    const won = teamId === game.teamA ? set.a > set.b : set.b > set.a;
    return `<strong class="${won ? 'set-won' : ''}">${score}</strong>`;
  }).join('');
};

// Venue names arrive as "Gameville Ball Park · Court 1". Every game is at
// the same venue, so only the court half earns its place on the card.
const courtLabel = (venue) => (venue || '').split('·').pop().trim();

// A rounded-rect play glyph rather than the YouTube wordmark: the label sits at
// 9px where the brand mark is unreadable, and it would wrongly imply the link
// leaves the site when it goes to /mvl/videos.
const playIcon =
  '<svg class="watch-video-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="currentColor"/>' +
  '<path d="M10 9.2v5.6l4.8-2.8z" fill="#0b0718"/></svg>';

const renderMatches = () => {
  const gamesForDay = games
    .filter((game) => game.day === activeDay)
    .filter((game) => {
      if (!selectedTeamId) return true;
      if (game.teamALabel || game.teamBLabel) return false;
      return [game.teamA, game.teamB].includes(selectedTeamId);
    })
    .sort((a, b) => (a.gameOrder || 999) - (b.gameOrder || 999) || new Date(a.startsAt) - new Date(b.startsAt));

  if (!gamesForDay.length) {
    const team = teamById[selectedTeamId];
    matchList.innerHTML = `
      <p class="match-empty">
        ${team ? `${escapeHtml(team.name)} has no scheduled game on Day ${activeDay}.` : `No games scheduled for Day ${activeDay}.`}
      </p>
    `;
    return;
  }

  matchList.innerHTML = gamesForDay.map((game) => {
    const teamA = gameTeam(game, 'A');
    const teamB = gameTeam(game, 'B');
    const winner = game.winner ? teamById[game.winner] : null;
    const pogTeam = game.playerOfGame?.team ? teamById[game.playerOfGame.team] : null;
    const pogPhoto = playerPhotoUrl(game.playerOfGame?.photoPath);
    const videoCount = Array.isArray(game.videos)
      ? game.videos.length
      : (game.youtubeId ? 1 : 0);
    // Once a result is published the video lives in the library, so link there.
    // Before that the only thing attached is the upcoming stream, which the
    // library deliberately excludes — point straight at YouTube so people can
    // still open and save it.
    const played = game.status === 'final';
    const firstVideoId = Array.isArray(game.videos) ? game.videos[0]?.youtubeId : game.youtubeId;
    const videoHref = !videoCount ? ''
      : played ? `/mvl/videos.html?game=${encodeURIComponent(game.id)}`
      : (firstVideoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(firstVideoId)}` : '');
    const playoffNote = playoffNotes[game.id];

    return `
      <article class="match-card ${game.status === 'final' ? 'is-final' : 'is-pending'}">
        <div class="match-meta">
          ${playoffNote ? `
            <div class="match-stage">
              <strong>${playoffNote.round}</strong>
              <small>${playoffNote.matchup}</small>
            </div>
          ` : ''}
          <div class="match-when">
            <span class="match-time">${formatTime(game.startsAt)}</span>
            <span class="match-court">${escapeHtml(courtLabel(game.court))}</span>
          </div>
        </div>

        <div class="match-teams">
          <div class="match-team${teamA.bg ? ' match-team--art' : ''}${winner?.id === teamA.id ? ' is-winner' : ''}" style="--team-a:${teamA.grad[0]}; --team-b:${teamA.grad[1]}${teamA.bg ? `; --team-art:url('${teamA.bg}')` : ''}">
            <small>${winner?.id === teamA.id ? 'Winner' : '&nbsp;'}</small>
            <p>${teamA.name}</p>
            <div class="match-score">${scoreLine(game, game.teamA)}</div>
          </div>
          <span class="match-vs">VS</span>
          <div class="match-team match-team--right${teamB.bg ? ' match-team--art' : ''}${winner?.id === teamB.id ? ' is-winner' : ''}" style="--team-a:${teamB.grad[0]}; --team-b:${teamB.grad[1]}${teamB.bg ? `; --team-art:url('${teamB.bg}')` : ''}">
            <small>${winner?.id === teamB.id ? 'Winner' : '&nbsp;'}</small>
            <p>${teamB.name}</p>
            <div class="match-score">${scoreLine(game, game.teamB)}</div>
          </div>
        </div>

        <div class="match-feature">
          <div class="player-portrait ${pogPhoto ? 'has-photo' : ''}${pogTeam?.bg ? ' player-portrait--art' : ''}"${pogTeam ? ` style="--team-a:${pogTeam.grad[0]}; --team-b:${pogTeam.grad[1]}${pogTeam.bg ? `; --team-art:url('${pogTeam.bg}')` : ''}"` : ''}>
            ${pogPhoto
              ? `<img src="${escapeHtml(pogPhoto)}" alt="${escapeHtml(game.playerOfGame?.name || 'Player of the Game')}">`
              : '<div class="player-silhouette" aria-hidden="true"></div>'}
          </div>
          <div>
            <p class="feature-label">Player of the Game</p>
            <h3>${escapeHtml(game.playerOfGame?.name || 'To be announced')}</h3>
            <p>${pogTeam ? `${escapeHtml(pogTeam.name)}${game.playerOfGame?.jerseyNumber ? ` · #${escapeHtml(game.playerOfGame.jerseyNumber)}` : ''}` : 'Pending final result'}</p>
          </div>
        </div>

        <div class="match-actions">
          ${winner ? '' : '<span class="winner-pill winner-pill--pending">Awaiting score</span>'}
          ${videoHref ? `<a class="watch-video" href="${videoHref}"${played ? '' : ' target="_blank" rel="noopener"'}>${playIcon}${played ? 'Watch Video' : 'Watch Live'}</a>` : '<span class="video-pending">Video pending</span>'}
        </div>
      </article>
    `;
  }).join('');
};

dayTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-day]');
  if (!button) return;
  activeDay = Number(button.dataset.day);
  renderTabs();
  renderMatches();
  // replaceState, not a hash assignment: the latter scrolls the page and stacks
  // a history entry per tab, so Back would walk the tabs instead of leaving.
  window.history.replaceState(null, '', `#day-${activeDay}`);
});

// back/forward between shared day links
window.addEventListener('hashchange', () => {
  const day = dayFromHash();
  if (day === null || day === activeDay) return;
  activeDay = day;
  renderTabs();
  renderMatches();
});

teamFilter?.addEventListener('change', () => {
  selectedTeamId = teamFilter.value;
  renderMatches();
});

renderTeamFilter();
renderTabs();
renderMatches();

// Both panels are filled in by JS, so the browser's own fragment jump fires
// against an empty page and lands nowhere. Redo it once the content exists:
// #day-N names a day rather than an element, so it aims at the games board;
// anything else is a real id (#standings) the browser would have handled.
const scrollToHash = () => {
  const target = dayFromHash() !== null
    ? document.getElementById('games')
    : (window.location.hash.length > 1 && document.getElementById(window.location.hash.slice(1)));
  target?.scrollIntoView({ block: 'start' });
};
if (window.location.hash) scrollToHash();
