const { teams, games } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
const teamFilter = document.getElementById('videoTeamFilter');
const dayFilter = document.getElementById('videoDayFilter');
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

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const validYouTubeId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '');
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
  featureMatchup.textContent = `${teamA} vs ${teamB}`;
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

const renderVideos = () => {
  const selectedTeam = teamFilter.value;
  const selectedDay = dayFilter.value;
  const filtered = videoRecords.filter(({ game }) =>
    (!selectedTeam || [game.teamA, game.teamB].includes(selectedTeam)) &&
    (!selectedDay || String(game.day) === selectedDay)
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
          <h3>${escapeHtml(teamA)} <em>vs</em> ${escapeHtml(teamB)}</h3>
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

teamFilter.addEventListener('change', renderVideos);
dayFilter.addEventListener('change', renderVideos);
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

renderLatestGame();
renderVideos();
