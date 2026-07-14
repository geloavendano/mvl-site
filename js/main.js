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

// ---- hero: scroll-built intro ----------------------------------------------
const heroSequence = document.querySelector('[data-hero-sequence]');
const heroLayers = {
  rays: document.querySelector('[data-hero-layer="rays"]'),
  star: document.querySelector('[data-hero-layer="star"]'),
  player: document.querySelector('[data-hero-layer="player"]'),
  logo: document.querySelector('[data-hero-layer="logo"]'),
};
const heroCopy = document.querySelector('[data-hero-copy]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const progressBetween = (value, start, end) => clamp((value - start) / (end - start));
const easeOut = (value) => 1 - Math.pow(1 - value, 3);
const lerp = (from, to, progress) => from + (to - from) * progress;

const setLayer = (layer, values) => {
  if (!layer) return;
  Object.entries(values).forEach(([key, value]) => {
    layer.style.setProperty(key, value);
  });
};

const updateHeroSequence = () => {
  if (!heroSequence) return;

  if (reduceMotion) {
    Object.values(heroLayers).forEach((layer) => setLayer(layer, {
      '--layer-opacity': 1,
      '--layer-x': '0px',
      '--layer-y': '0px',
      '--layer-scale': 1,
      '--layer-rotate': '0deg',
      '--layer-blur': '0px',
    }));
    if (heroCopy) heroCopy.style.setProperty('--hero-copy-opacity', 1);
    nav.classList.add('hero-ready');
    return;
  }

  const rect = heroSequence.getBoundingClientRect();
  const travel = heroSequence.offsetHeight - window.innerHeight;
  const progress = travel > 0 ? clamp(-rect.top / travel) : 1;
  const isPinned = rect.top <= 0 && rect.bottom > window.innerHeight;
  heroSequence.classList.toggle('hero-is-pinned', isPinned);
  heroSequence.classList.toggle('hero-is-done', rect.bottom <= window.innerHeight);

  const rays = easeOut(progressBetween(progress, 0.02, 0.22));
  const star = easeOut(progressBetween(progress, 0.18, 0.42));
  const player = easeOut(progressBetween(progress, 0.38, 0.66));
  const logo = easeOut(progressBetween(progress, 0.62, 0.84));
  const copy = easeOut(progressBetween(progress, 0.78, 0.96));
  nav.classList.toggle('hero-ready', copy > .98);

  setLayer(heroLayers.rays, {
    '--layer-opacity': rays,
    '--layer-x': `${lerp(-34, 0, rays).toFixed(1)}px`,
    '--layer-y': `${lerp(20, 0, rays).toFixed(1)}px`,
    '--layer-scale': lerp(1.16, 1, rays).toFixed(3),
    '--layer-rotate': `${lerp(-10, 0, rays).toFixed(2)}deg`,
    '--layer-blur': `${lerp(10, 0, rays).toFixed(1)}px`,
  });
  setLayer(heroLayers.star, {
    '--layer-opacity': star,
    '--layer-x': `${lerp(44, 0, star).toFixed(1)}px`,
    '--layer-y': `${lerp(58, 0, star).toFixed(1)}px`,
    '--layer-scale': lerp(.72, 1, star).toFixed(3),
    '--layer-rotate': `${lerp(8, 0, star).toFixed(2)}deg`,
    '--layer-blur': `${lerp(12, 0, star).toFixed(1)}px`,
  });
  setLayer(heroLayers.player, {
    '--layer-opacity': player,
    '--layer-x': `${lerp(-44, 0, player).toFixed(1)}px`,
    '--layer-y': `${lerp(92, 0, player).toFixed(1)}px`,
    '--layer-scale': lerp(.82, 1, player).toFixed(3),
    '--layer-rotate': `${lerp(-6, 0, player).toFixed(2)}deg`,
    '--layer-blur': `${lerp(10, 0, player).toFixed(1)}px`,
  });
  setLayer(heroLayers.logo, {
    '--layer-opacity': logo,
    '--layer-x': `${lerp(0, 0, logo).toFixed(1)}px`,
    '--layer-y': `${lerp(-42, 0, logo).toFixed(1)}px`,
    '--layer-scale': lerp(.78, 1, logo).toFixed(3),
    '--layer-rotate': `${lerp(4, 0, logo).toFixed(2)}deg`,
    '--layer-blur': `${lerp(8, 0, logo).toFixed(1)}px`,
  });
  if (heroCopy) heroCopy.style.setProperty('--hero-copy-opacity', copy.toFixed(3));
};

let heroRaf = 0;
const requestHeroUpdate = () => {
  if (heroRaf) return;
  heroRaf = requestAnimationFrame(() => {
    heroRaf = 0;
    updateHeroSequence();
  });
};

window.addEventListener('scroll', requestHeroUpdate, { passive: true });
window.addEventListener('resize', requestHeroUpdate);
updateHeroSequence();

if (heroSequence && !reduceMotion && !sessionStorage.getItem('mvlHeroIntroSeen')) {
  sessionStorage.setItem('mvlHeroIntroSeen', 'true');
  window.setTimeout(() => {
    if (window.scrollY > window.innerHeight * 0.25) return;
    const start = window.scrollY;
    const target = Math.max(0, Math.round(heroSequence.offsetHeight - window.innerHeight - 24));
    const duration = 1450;
    const startedAt = performance.now();

    const step = (now) => {
      const progress = clamp((now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      window.scrollTo(0, Math.round(lerp(start, target, eased)));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, 650);
}

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
