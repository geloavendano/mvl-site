const { teams, games } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));

const formatTime = (iso) => new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
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
  const finalGames = games.filter((game) => game.status === 'final');

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
let activeDay = days[0];

const dayTabs = document.getElementById('dayTabs');
const matchList = document.getElementById('matchList');

const renderTabs = () => {
  dayTabs.innerHTML = days.map((day) => `
    <button class="day-tab ${day === activeDay ? 'is-active' : ''}" type="button" data-day="${day}" role="tab" aria-selected="${day === activeDay}">
      ${day === activeDay ? `Day ${day}` : day}
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

const gameStatus = (game) => {
  if (game.status === 'final') return 'Final';
  const now = new Date();
  const startsAt = new Date(game.startsAt);
  return startsAt > now ? 'Upcoming' : 'Pending';
};

const renderMatches = () => {
  const gamesForDay = games
    .filter((game) => game.day === activeDay)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  matchList.innerHTML = gamesForDay.map((game) => {
    const teamA = teamById[game.teamA];
    const teamB = teamById[game.teamB];
    const winner = game.winner ? teamById[game.winner] : null;
    const pogTeam = game.playerOfGame?.team ? teamById[game.playerOfGame.team] : null;
    const videoHref = game.youtubeId ? `https://www.youtube.com/watch?v=${game.youtubeId}` : '';

    return `
      <article class="match-card ${game.status === 'final' ? 'is-final' : 'is-pending'}">
        <div class="match-meta">
          <span>${gameStatus(game)}</span>
          <span>${formatTime(game.startsAt)}</span>
          <span>${game.court}</span>
        </div>

        <div class="match-teams">
          <div class="match-team" style="--team-a:${teamA.grad[0]}; --team-b:${teamA.grad[1]}">
            <small>${winner?.id === teamA.id ? 'Winner' : '&nbsp;'}</small>
            <p>${teamA.name}</p>
            <div class="match-score">${scoreLine(game, game.teamA)}</div>
          </div>
          <span class="match-vs">VS</span>
          <div class="match-team match-team--right" style="--team-a:${teamB.grad[0]}; --team-b:${teamB.grad[1]}">
            <small>${winner?.id === teamB.id ? 'Winner' : '&nbsp;'}</small>
            <p>${teamB.name}</p>
            <div class="match-score">${scoreLine(game, game.teamB)}</div>
          </div>
        </div>

        <div class="match-feature">
          <div class="player-silhouette" aria-hidden="true"></div>
          <div>
            <p class="feature-label">Player of the Game</p>
            <h3>${game.playerOfGame?.name || 'To be announced'}</h3>
            <p>${pogTeam?.name || 'Pending final result'}</p>
          </div>
        </div>

        <div class="match-actions">
          ${winner ? `<span class="winner-pill">Winner: ${winner.name}</span>` : '<span class="winner-pill winner-pill--pending">Awaiting score</span>'}
          ${videoHref ? `<a href="${videoHref}" target="_blank" rel="noopener">Watch</a>` : '<span class="video-pending">Video pending</span>'}
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
});

renderTabs();
renderMatches();
