const { teams, games } = window.MVL_DATA;
const teamById = Object.fromEntries(teams.map((team) => [team.id, team]));
const teamFilter = document.getElementById('videoTeamFilter');
const dayFilter = document.getElementById('videoDayFilter');
const libraryGrid = document.getElementById('videoLibraryGrid');
const emptyState = document.getElementById('videoLibraryEmpty');
const resultCount = document.getElementById('videoResultCount');

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const validYouTubeId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '');
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
  .filter((game) => validYouTubeId(game.youtubeId))
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

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
  const filtered = videoGames.filter((game) =>
    (!selectedTeam || [game.teamA, game.teamB].includes(selectedTeam)) &&
    (!selectedDay || String(game.day) === selectedDay)
  );

  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'video' : 'videos'}`;
  emptyState.classList.toggle('is-hidden', filtered.length > 0);
  libraryGrid.classList.toggle('is-hidden', filtered.length === 0);
  libraryGrid.innerHTML = filtered.map((game) => {
    const teamA = gameTeamName(game, 'A');
    const teamB = gameTeamName(game, 'B');
    const winner = game.winner ? teamById[game.winner]?.name : '';
    return `
      <article class="library-video-card" id="game-${escapeHtml(game.id)}">
        <div class="library-video-player">
          <button type="button" data-play-video="${game.youtubeId}" aria-label="Play ${escapeHtml(teamA)} versus ${escapeHtml(teamB)}">
            <img src="https://i.ytimg.com/vi/${game.youtubeId}/hqdefault.jpg" alt="" loading="lazy">
            <span class="play-btn" aria-hidden="true"></span>
          </button>
        </div>
        <div class="library-video-copy">
          <p class="video-library-meta">Day ${game.day} · ${formatDate(game.startsAt)} · ${formatTime(game.startsAt)}</p>
          <h3>${escapeHtml(teamA)} <em>vs</em> ${escapeHtml(teamB)}</h3>
          <p>${escapeHtml(game.court)}${winner ? ` · Winner: ${escapeHtml(winner)}` : ''}</p>
          <div class="library-video-actions">
            <span>${escapeHtml(game.duration || 'Full game')}</span>
            <a href="https://www.youtube.com/watch?v=${game.youtubeId}" target="_blank" rel="noopener">Open on YouTube</a>
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
  button.outerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1"
      title="MVL game video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
  `;
});

renderVideos();

