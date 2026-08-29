const { teams, games, livestream } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
const teamFilter = document.getElementById('videoTeamFilter');
const dayFilter = document.getElementById('videoDayFilter');
const gameFilter = document.getElementById('videoGameFilter');
const filterClear = document.getElementById('videoFilterClear');
const libraryGrid = document.getElementById('videoLibraryGrid');
const emptyState = document.getElementById('videoLibraryEmpty');
const resultCount = document.getElementById('videoResultCount');
const feature = document.getElementById('latestGame');
const featureMedia = document.getElementById('latestVideoMedia');
const featurePoster = document.getElementById('latestVideoPoster');
const featureMatchup = document.getElementById('latestGameMatchup');
const featureMeta = document.getElementById('latestGameMeta');
const featureResult = document.getElementById('latestGameResult');
const featurePlay = document.getElementById('latestVideoPlay');
const featureClose = document.getElementById('latestVideoClose');
const liveSection = document.getElementById('videoLiveStreams');
const liveGrid = document.getElementById('videoLiveGrid');
const liveTitle = document.getElementById('videoLiveTitle');

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const validYouTubeId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '');
const activeLivestreams = (livestream.streams || [])
  .filter((stream) => stream.isLive && validYouTubeId(stream.youtubeId))
  .sort((a, b) => a.court.localeCompare(b.court));
if (activeLivestreams.length) {
  liveSection.classList.remove('is-hidden');
  liveTitle.textContent = activeLivestreams.length > 1 ? 'Watch Both Courts' : `Watch ${activeLivestreams[0].court}`;
  liveGrid.classList.toggle('has-two-streams', activeLivestreams.length > 1);
  liveGrid.innerHTML = activeLivestreams.map((stream, index) => `
    <article class="videos-live-card${index === 0 ? ' is-primary' : ''}">
      <div class="videos-live-card-head"><p><span class="live-dot" aria-hidden="true"></span>${escapeHtml(stream.court)}</p>${index === 0 ? '<strong>Primary stream</strong>' : ''}</div>
      <div class="videos-live-player"><iframe src="https://www.youtube-nocookie.com/embed/${stream.youtubeId}?autoplay=1&mute=1" title="MVL livestream · ${escapeHtml(stream.court)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
      <a href="https://www.youtube.com/watch?v=${stream.youtubeId}" target="_blank" rel="noopener">Open ${escapeHtml(stream.court)} on YouTube</a>
    </article>
  `).join('');
}
const gameVideos = (game) => {
  if (Array.isArray(game.videos)) {
    return game.videos.filter((video) => validYouTubeId(video.youtubeId));
  }
  return validYouTubeId(game.youtubeId)
    ? [{ youtubeId: game.youtubeId, label: game.videoLabel || 'Full Game', duration: game.duration || '' }]
    : [];
};
const gameTeamName = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  return label || teamById[id]?.name || 'TBD';
};
// Same team-colour language as /gametime and /schedule.
const gameTeam = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  return teamById[id] || { id, grad: ['#4338CA', '#16104A'] };
};
const teamMark = (team) =>
  `<span class="standing-team-mark" style="--team-a:${team.grad[0]}; --team-b:${team.grad[1]}"></span>`;
const formatDate = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(iso));
const formatTime = (iso) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(iso));

const videoGames = games
  .filter((game) => gameVideos(game).length)
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
const videoRecords = videoGames.flatMap((game) =>
  gameVideos(game).map((video, index) => ({ game, video, index }))
);
const latestGame = videoGames[0];
const latestVideos = latestGame ? gameVideos(latestGame) : [];
const latestVideo = latestVideos.find((video) => /full\s*game/i.test(video.label || '')) || latestVideos[0];

const renderLatestGame = () => {
  if (!latestGame || !latestVideo) {
    feature.classList.add('is-empty');
    return;
  }

  const teamA = gameTeamName(latestGame, 'A');
  const teamB = gameTeamName(latestGame, 'B');
  const winner = latestGame.winner ? (teamById[latestGame.winner]?.name || latestGame.winner) : '';
  const label = latestVideo.label || 'Full Game';
  const maxresPoster = `https://i.ytimg.com/vi/${latestVideo.youtubeId}/maxresdefault.jpg`;
  const fallbackPoster = `https://i.ytimg.com/vi/${latestVideo.youtubeId}/hqdefault.jpg`;

  featurePoster.src = maxresPoster;
  featurePoster.onerror = () => {
    if (featurePoster.src !== fallbackPoster) featurePoster.src = fallbackPoster;
  };
  featureMatchup.innerHTML =
    `<span class="video-team">${teamMark(gameTeam(latestGame, 'A'))}${escapeHtml(teamA)}</span>` +
    ` <span class="video-vs">vs</span> ` +
    `<span class="video-team">${teamMark(gameTeam(latestGame, 'B'))}${escapeHtml(teamB)}</span>`;
  featureMeta.textContent = `Day ${latestGame.day} · ${formatDate(latestGame.startsAt)} · ${formatTime(latestGame.startsAt)}`;
  featureResult.textContent = `${winner ? `Winner: ${winner}` : 'Result pending'} · ${label}${latestVideo.duration ? ` · ${latestVideo.duration}` : ''}`;
  featurePlay.disabled = false;
  featurePlay.dataset.videoId = latestVideo.youtubeId;
  featurePlay.dataset.videoLabel = label;
  featurePlay.setAttribute('aria-label', `Play ${label}: ${teamA} versus ${teamB}`);
};

const availableTeamIds = new Set(videoGames.flatMap((game) => [game.teamA, game.teamB]));
teamFilter.insertAdjacentHTML('beforeend', teams
  .filter((team) => availableTeamIds.has(team.id))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`)
  .join(''));

const dayGames = new Map();
videoGames.forEach((game) => {
  if (!dayGames.has(game.day)) dayGames.set(game.day, game);
});
dayFilter.insertAdjacentHTML('beforeend', [...dayGames.entries()]
  .sort(([a], [b]) => b - a)
  .map(([day, game]) => `<option value="${day}">Day ${day} · ${formatDate(game.startsAt)}</option>`)
  .join(''));

// Same shape as the admin console's game picker: day, time, then the matchup.
// Rebuilt whenever team or day changes so the list only offers games that are
// still reachable under the other two filters.
const gameOptionLabel = (game) =>
  `Day ${game.day} · ${formatTime(game.startsAt)} · ${gameTeamName(game, 'A')} vs ${gameTeamName(game, 'B')}`;

const syncGameOptions = () => {
  const selectedTeam = teamFilter.value;
  const selectedDay = dayFilter.value;
  const keep = gameFilter.value;
  const options = videoGames.filter((game) =>
    (!selectedTeam || [game.teamA, game.teamB].includes(selectedTeam)) &&
    (!selectedDay || String(game.day) === selectedDay)
  );
  gameFilter.innerHTML = '<option value="">All games</option>' + options
    .map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(gameOptionLabel(game))}</option>`)
    .join('');
  // a game that no longer survives the other filters cannot stay selected
  gameFilter.value = options.some((game) => game.id === keep) ? keep : '';
};

// Filters live in the query string so a view can be linked to — the schedule's
// "Watch video" points straight at ?game=<id>. replaceState rather than push:
// changing a dropdown is not a navigation the back button should replay.
const syncUrl = () => {
  const params = new URLSearchParams();
  if (teamFilter.value) params.set('team', teamFilter.value);
  if (dayFilter.value) params.set('day', dayFilter.value);
  if (gameFilter.value) params.set('game', gameFilter.value);
  const query = params.toString();
  history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
};

const renderVideos = () => {
  const selectedTeam = teamFilter.value;
  const selectedDay = dayFilter.value;
  const selectedGame = gameFilter.value;
  filterClear.classList.toggle('is-hidden', !(selectedTeam || selectedDay || selectedGame));
  const filtered = videoRecords.filter(({ game }) =>
    (!selectedTeam || [game.teamA, game.teamB].includes(selectedTeam)) &&
    (!selectedDay || String(game.day) === selectedDay) &&
    (!selectedGame || game.id === selectedGame)
  );

  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'video' : 'videos'}`;
  emptyState.classList.toggle('is-hidden', filtered.length > 0);
  libraryGrid.classList.toggle('is-hidden', filtered.length === 0);
  libraryGrid.innerHTML = filtered.map(({ game, video, index }) => {
    const teamA = gameTeamName(game, 'A');
    const teamB = gameTeamName(game, 'B');
    const winner = game.winner ? teamById[game.winner]?.name : '';
    const label = video.label || `Video ${index + 1}`;
    const cardId = index === 0 ? `game-${game.id}` : `game-${game.id}-video-${index + 1}`;
    return `
      <article class="library-video-card" id="${escapeHtml(cardId)}">
        <div class="library-video-player">
          <button type="button" data-play-video="${video.youtubeId}" data-video-label="${escapeHtml(label)}" aria-label="Play ${escapeHtml(label)}: ${escapeHtml(teamA)} versus ${escapeHtml(teamB)}">
            <img src="https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg" alt="" loading="lazy">
            <span class="play-btn" aria-hidden="true"></span>
          </button>
        </div>
        <div class="library-video-copy">
          <p class="video-library-meta">Day ${game.day} · ${formatDate(game.startsAt)} · ${formatTime(game.startsAt)}</p>
          <h3><span class="video-team">${teamMark(gameTeam(game, 'A'))}${escapeHtml(teamA)}</span> <em>vs</em> <span class="video-team">${teamMark(gameTeam(game, 'B'))}${escapeHtml(teamB)}</span></h3>
          <p>${escapeHtml(game.court)}${winner ? ` · Winner: ${escapeHtml(winner)}` : ''}</p>
          <div class="library-video-actions">
            <span>${escapeHtml(label)}${video.duration ? ` · ${escapeHtml(video.duration)}` : ''}</span>
            <a href="https://www.youtube.com/watch?v=${video.youtubeId}" target="_blank" rel="noopener">Open on YouTube</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
};

const onFilterChange = () => { syncGameOptions(); syncUrl(); renderVideos(); };
teamFilter.addEventListener('change', onFilterChange);
dayFilter.addEventListener('change', onFilterChange);
gameFilter.addEventListener('change', () => { syncUrl(); renderVideos(); });
filterClear.addEventListener('click', () => {
  teamFilter.value = '';
  dayFilter.value = '';
  gameFilter.value = '';
  onFilterChange();
});
libraryGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-play-video]');
  if (!button) return;
  const videoId = button.dataset.playVideo;
  if (!validYouTubeId(videoId)) return;
  const label = button.dataset.videoLabel || 'MVL game video';
  button.outerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1"
      title="${escapeHtml(label)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
  `;
});

featurePlay.addEventListener('click', () => {
  const videoId = featurePlay.dataset.videoId;
  if (!validYouTubeId(videoId)) return;
  const label = featurePlay.dataset.videoLabel || 'Latest MVL game';
  feature.classList.add('is-playing');
  featureClose.classList.remove('is-hidden');
  featureMedia.innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1"
      title="${escapeHtml(label)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
  `;
  featureClose.focus();
});

featureClose.addEventListener('click', () => {
  feature.classList.remove('is-playing');
  featureClose.classList.add('is-hidden');
  featureMedia.innerHTML = '<img id="latestVideoPoster" src="" alt="">';
  const restoredPoster = featureMedia.querySelector('img');
  restoredPoster.src = `https://i.ytimg.com/vi/${latestVideo.youtubeId}/maxresdefault.jpg`;
  restoredPoster.onerror = () => {
    if (restoredPoster.dataset.fallbackApplied) return;
    restoredPoster.dataset.fallbackApplied = 'true';
    restoredPoster.src = `https://i.ytimg.com/vi/${latestVideo.youtubeId}/hqdefault.jpg`;
  };
  featurePlay.focus();
});

// ---- open on whatever the URL asked for -------------------------------------
// ?team=&day=&game= from the schedule's "Watch video" and from any shared link.
// #game-<id> is the older anchor form those links used, so it still resolves —
// it selects the game rather than only scrolling to a card.
const applyUrlFilters = () => {
  const params = new URLSearchParams(location.search);
  const team = params.get('team') || '';
  const day = params.get('day') || '';
  let game = params.get('game') || '';

  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  const legacy = hash.match(/^game-([^-]+(?:-[^-]+)*?)(?:-video-\d+)?$/);
  if (!game && legacy && videoGames.some((g) => g.id === legacy[1])) game = legacy[1];

  if ([...teamFilter.options].some((o) => o.value === team)) teamFilter.value = team;
  if ([...dayFilter.options].some((o) => o.value === day)) dayFilter.value = day;
  syncGameOptions();
  if ([...gameFilter.options].some((o) => o.value === game)) gameFilter.value = game;

  // a game filter that matched nothing would leave an empty library with no
  // explanation, so fall back to unfiltered rather than a dead end
  if (game && gameFilter.value !== game) gameFilter.value = '';
};

renderLatestGame();
applyUrlFilters();
renderVideos();
