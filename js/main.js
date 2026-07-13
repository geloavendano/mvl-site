/* ==========================================================================
   MVL 2026 — Phase 2 landing page
   Content lives in the data arrays below; layout never needs touching
   to update teams / sponsors / games.
   ========================================================================== */

// ---- state ---------------------------------------------------------------
const isLive = true; // TODO: flip manually (or via YouTube API) when stream is live

// ---- data ----------------------------------------------------------------
const { teams: TEAMS, sponsors: SPONSORS, games: GAMES, livestream } = window.MVL_DATA;
const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]));

// ---- render: team cards ----------------------------------------------------
const teamsGrid = document.getElementById('teamsGrid');
teamsGrid.innerHTML = TEAMS.map((team, i) => `
  <article class="team-card reveal"
           style="--team-a:${team.grad[0]}; --team-b:${team.grad[1]}; --photo-pos:${team.pos}; --d:${(i % 4) * 55}ms">
    <div class="team-card-photo" aria-hidden="true"></div>
    <div class="team-card-shards" aria-hidden="true"></div>
    <div class="team-card-copy">
      <p class="team-card-index">${String(i + 1).padStart(2, '0')} / ${String(TEAMS.length).padStart(2, '0')}</p>
      <h3 class="team-card-name">${team.name}</h3>
      <p class="team-card-tag">${team.tag}</p>
    </div>
    <a class="team-card-link" href="team.html?id=${team.id}" aria-label="${team.name} team page">&#8599;</a>
  </article>
`).join('');

// ---- render: livestream ----------------------------------------------------
document.querySelectorAll('[data-livestream-link]').forEach((link) => {
  link.href = livestream.youtubeUrl;
  link.target = '_blank';
  link.rel = 'noopener';
});

const liveEmbed = document.getElementById('liveEmbed');
if (liveEmbed && livestream.youtubeId) {
  liveEmbed.classList.remove('placeholder');
  liveEmbed.innerHTML = `
    <iframe
      src="https://www.youtube-nocookie.com/embed/${livestream.youtubeId}"
      title="MVL livestream"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen></iframe>
  `;
}

// ---- render: past game cards ----------------------------------------------
const completedGames = GAMES
  .filter((game) => game.status === 'final')
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
  .slice(0, 6);

const gameCard = (game) => {
  const teamA = teamById[game.teamA];
  const teamB = teamById[game.teamB];
  const href = game.youtubeId ? `https://www.youtube.com/watch?v=${game.youtubeId}` : 'schedule.html';
  return `
  <a class="video-card reveal" href="${href}" ${game.youtubeId ? 'target="_blank" rel="noopener"' : ''}>
    <div class="video-thumb ${game.youtubeId ? '' : 'placeholder'}">
      <span class="play-btn play-btn--sm" aria-hidden="true"></span>
    </div>
    <p class="video-title">${teamA.name} vs ${teamB.name}</p>
    <p class="video-meta">${game.youtubeId ? 'Full Game' : 'Result'} &middot; ${game.duration || 'Pending video'}</p>
  </a>
`;
};
document.getElementById('pastSide').innerHTML = completedGames.slice(0, 2).map(gameCard).join('');
document.getElementById('pastBottom').innerHTML = completedGames.slice(2, 6).map(gameCard).join('');

// ---- render: sponsor marquees (list duplicated for the seamless loop) ------
document.querySelectorAll('[data-marquee]').forEach((track) => {
  const seq = SPONSORS.map((s) =>
    `<span class="marquee-item">${s}</span><span class="marquee-sep">&#9670;</span>`
  ).join('');
  track.innerHTML = seq + seq;
});

// ---- live state -------------------------------------------------------------
if (!isLive) {
  document.querySelectorAll('.live-dot').forEach((d) => { d.style.animation = 'none'; d.style.opacity = '.35'; });
}

// ---- nav: logo joins the bar past the hero ---------------------------------
const nav = document.getElementById('nav');
const hero = document.getElementById('hero');

new IntersectionObserver(([entry]) => {
  nav.classList.toggle('nav--stuck', !entry.isIntersecting);
}, {
  // trigger once the hero's bottom clears the nav
  rootMargin: '-64px 0px 0px 0px',
  threshold: 0,
}).observe(hero);

// ---- scroll-triggered reveals (animate once) --------------------------------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

document.querySelectorAll('.reveal').forEach((el, i) => {
  // stagger siblings that enter together (video cards, bands)
  if (!el.style.getPropertyValue('--d')) {
    el.style.setProperty('--d', `${(i % 4) * 70}ms`);
  }
  revealObserver.observe(el);
});
