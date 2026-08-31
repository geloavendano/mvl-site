const { teams, games, livestream } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
const teamFilter = document.getElementById('videoTeamFilter');
const dayFilter = document.getElementById('videoDayFilter');
const gameFilter = document.getElementById('videoGameFilter');
const filterClear = document.getElementById('videoFilterClear');
const libraryGrid = document.getElementById('videoLibraryGrid');
const emptyState = document.getElementById('videoLibraryEmpty');
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
    ? [{ youtubeId: game.youtubeId, label: game.videoLabel || 'Live Replay', duration: game.duration || '' }]
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

// Livestream links are attached ahead of a game so people can save them from
// the schedule. The library is a record of games that have been played, so it
// only carries games whose result is published — an upcoming fixture's link
// would otherwise sit here as if it were a recording.
const hasPublishedResult = (game) => game.status === 'final';

const videoGames = games
  .filter((game) => gameVideos(game).length && hasPublishedResult(game))
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
const videoRecords = videoGames.flatMap((game) =>
  gameVideos(game).map((video, index) => ({ game, video, index }))
);
const latestGame = videoGames[0];
const latestVideos = latestGame ? gameVideos(latestGame) : [];
// Prefer the on-site capture: it is the same game without the stream's lag.
// This replaces a rule that looked for a "Full Game" label, which no video
// carries since the rename — it had quietly become a no-op falling through to
// whichever video happened to be first.
const latestVideo =
  latestVideos.find((video) => /local\s*recording/i.test(video.label || '')) || latestVideos[0];

// The feature panel is the page's only player. It opens on the latest game and
// is retargeted whenever a library card is picked, so the details beside it —
// matchup, day, result, label — always describe what is on screen.
const featureLabel = document.querySelector('.videos-feature-label');
let featureGame = null;
let featureVideo = null;

const setFeature = (game, video, { isLatest = false } = {}) => {
  featureGame = game;
  featureVideo = video;

  const teamA = gameTeamName(game, 'A');
  const teamB = gameTeamName(game, 'B');
  const winner = game.winner ? (teamById[game.winner]?.name || game.winner) : '';
  const label = video.label || 'Live Replay';
  const maxresPoster = `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`;
  const fallbackPoster = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;

  const poster = featureMedia.querySelector('img');
  if (poster) {
    poster.src = maxresPoster;
    poster.onerror = () => {
      if (poster.src !== fallbackPoster) poster.src = fallbackPoster;
    };
  }
  if (featureLabel) featureLabel.lastChild.textContent = isLatest ? 'Latest Game' : 'Now Playing';
  featureMatchup.innerHTML =
    `<span class="video-team">${teamMark(gameTeam(game, 'A'))}${escapeHtml(teamA)}</span>` +
    ` <span class="video-vs">vs</span> ` +
    `<span class="video-team">${teamMark(gameTeam(game, 'B'))}${escapeHtml(teamB)}</span>`;
  featureMeta.textContent = `Day ${game.day} · ${formatDate(game.startsAt)} · ${formatTime(game.startsAt)}`;
  featureResult.textContent = `${winner ? `Winner: ${winner}` : 'Result pending'} · ${label}${video.duration ? ` · ${video.duration}` : ''}`;
  featurePlay.disabled = false;
  featurePlay.dataset.videoId = video.youtubeId;
  featurePlay.dataset.videoLabel = label;
  featurePlay.setAttribute('aria-label', `Play ${label}: ${teamA} versus ${teamB}`);
  featurePlay.lastChild.textContent = isLatest ? ' Play Latest Game' : ` Play ${label}`;
};

const playFeature = () => {
  const videoId = featurePlay.dataset.videoId;
  if (!validYouTubeId(videoId)) return;
  const label = featurePlay.dataset.videoLabel || 'MVL game video';
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
};

const renderLatestGame = () => {
  if (!latestGame || !latestVideo) {
    feature.classList.add('is-empty');
    return;
  }
  setFeature(latestGame, latestVideo, { isLatest: true });
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
          <button type="button" data-play-video="${video.youtubeId}" data-video-label="${escapeHtml(label)}" aria-label="Play ${escapeHtml(label)}, ${escapeHtml(teamA)} versus ${escapeHtml(teamB)}, in the player at the top of the page">
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
// A card no longer embeds its own player. It retargets the feature and plays
// there — one player, one size, and the grid stays light instead of carrying
// an iframe per card.
//
// The library sits a screen or more below the feature, so a pick that only
// swapped the video would load it off-screen above the reader and look like
// nothing happened. Scroll to the player on the way in, and back to the card
// they came from on the way out, so the round trip returns them where they
// were rather than at the top of the page.
let returnToCardId = '';
const motion = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

libraryGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-play-video]');
  if (!button) return;
  const videoId = button.dataset.playVideo;
  if (!validYouTubeId(videoId)) return;

  const card = button.closest('.library-video-card');
  const record = videoRecords.find(({ video }) => video.youtubeId === videoId);
  if (!record) return;

  returnToCardId = card?.id || '';
  libraryGrid.querySelectorAll('.is-playing').forEach((el) => el.classList.remove('is-playing'));
  card?.classList.add('is-playing');

  setFeature(record.game, record.video);
  playFeature();
  featureClose.textContent = 'Back to the library';
  feature.scrollIntoView({ behavior: motion(), block: 'start' });
  featureClose.focus({ preventScroll: true });
});

featurePlay.addEventListener('click', () => {
  returnToCardId = '';
  playFeature();
  featureClose.textContent = 'Back to video details';
  featureClose.focus({ preventScroll: true });
});

featureClose.addEventListener('click', () => {
  feature.classList.remove('is-playing');
  featureClose.classList.add('is-hidden');
  featureMedia.innerHTML = '<img id="latestVideoPoster" src="" alt="">';
  // restore the poster for whatever the feature currently holds, which is not
  // necessarily the latest game any more
  const shown = featureVideo || latestVideo;
  const restoredPoster = featureMedia.querySelector('img');
  restoredPoster.src = `https://i.ytimg.com/vi/${shown.youtubeId}/maxresdefault.jpg`;
  restoredPoster.onerror = () => {
    if (restoredPoster.dataset.fallbackApplied) return;
    restoredPoster.dataset.fallbackApplied = 'true';
    restoredPoster.src = `https://i.ytimg.com/vi/${shown.youtubeId}/hqdefault.jpg`;
  };

  const card = returnToCardId ? document.getElementById(returnToCardId) : null;
  if (card) {
    card.scrollIntoView({ behavior: motion(), block: 'center' });
    card.querySelector('[data-play-video]')?.focus({ preventScroll: true });
  } else {
    featurePlay.focus({ preventScroll: true });
  }
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

  return Boolean(teamFilter.value || dayFilter.value || gameFilter.value);
};

// Arriving from the schedule's "Watch video" landed at the top fold, which
// features an unrelated latest video — the filtered library the link promised
// was a screen further down. Jump to it, but only when a filter actually
// applied, so a plain visit still opens on the feature.
const revealLibrary = () => {
  const library = document.getElementById('videoLibraryTitle')?.closest('.video-library');
  if (!library) return;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  // after layout settles — the grid is written synchronously just above, but
  // the thumbnails it pulls in still change the page height
  requestAnimationFrame(() => library.scrollIntoView({ behavior, block: 'start' }));
};

renderLatestGame();
const openedFiltered = applyUrlFilters();
renderVideos();
if (openedFiltered) revealLibrary();
