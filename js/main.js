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
if (teamsGrid) {
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
}

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

// ---- render: schedule & standings preview ----------------------------------
const timeZone = 'Asia/Manila';
const homeScheduleTitle = document.getElementById('homeScheduleTitle');
const homeScheduleList = document.getElementById('homeScheduleList');
const homeStandingsList = document.getElementById('homeStandingsList');

const dateKey = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const formatPreviewDate = (iso) => new Intl.DateTimeFormat('en-US', {
  timeZone,
  month: 'short',
  day: 'numeric',
}).format(new Date(iso));

const formatPreviewTime = (iso) => new Intl.DateTimeFormat('en-US', {
  timeZone,
  hour: 'numeric',
  minute: '2-digit',
}).format(new Date(iso));

const setsWonBy = (game, teamId) => {
  if (!game.sets?.length) return 0;
  return game.sets.reduce((wins, set) => {
    const isA = game.teamA === teamId;
    const scored = isA ? set.a : set.b;
    const allowed = isA ? set.b : set.a;
    return wins + (scored > allowed ? 1 : 0);
  }, 0);
};

const pointsFor = (game, teamId) => (game.sets || []).reduce((sum, set) => {
  if (game.teamA === teamId) return sum + set.a;
  if (game.teamB === teamId) return sum + set.b;
  return sum;
}, 0);

const pointsAgainst = (game, teamId) => (game.sets || []).reduce((sum, set) => {
  if (game.teamA === teamId) return sum + set.b;
  if (game.teamB === teamId) return sum + set.a;
  return sum;
}, 0);

const ratio = (forValue, againstValue) => {
  if (!againstValue && forValue) return Number.POSITIVE_INFINITY;
  if (!againstValue) return 0;
  return forValue / againstValue;
};

const buildStandingsPreview = () => TEAMS.map((team) => {
  const played = GAMES.filter((game) =>
    game.status === 'final' && (game.teamA === team.id || game.teamB === team.id)
  );
  const wins = played.filter((game) => game.winner === team.id).length;
  const setsFor = played.reduce((sum, game) => sum + setsWonBy(game, team.id), 0);
  const setsAgainst = played.reduce((sum, game) => {
    const opponent = game.teamA === team.id ? game.teamB : game.teamA;
    return sum + setsWonBy(game, opponent);
  }, 0);
  const ptsFor = played.reduce((sum, game) => sum + pointsFor(game, team.id), 0);
  const ptsAgainst = played.reduce((sum, game) => sum + pointsAgainst(game, team.id), 0);

  return {
    ...team,
    wins,
    losses: played.length - wins,
    setRatio: ratio(setsFor, setsAgainst),
    pointRatio: ratio(ptsFor, ptsAgainst),
  };
}).sort((a, b) =>
  b.wins - a.wins ||
  b.setRatio - a.setRatio ||
  b.pointRatio - a.pointRatio ||
  a.name.localeCompare(b.name)
);

if (homeScheduleList && homeScheduleTitle) {
  const now = new Date();
  const today = dateKey(now);
  const sortedGames = [...GAMES].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const todayGames = sortedGames.filter((game) => dateKey(new Date(game.startsAt)) === today);
  const nextGame = sortedGames.find((game) => new Date(game.startsAt) >= now) || sortedGames.at(-1);
  const activeKey = todayGames.length ? today : dateKey(new Date(nextGame.startsAt));
  const activeGames = sortedGames.filter((game) => dateKey(new Date(game.startsAt)) === activeKey);

  homeScheduleTitle.textContent = todayGames.length
    ? `Today · ${formatPreviewDate(activeGames[0].startsAt)}`
    : `Next Games · ${formatPreviewDate(activeGames[0].startsAt)}`;

  homeScheduleList.innerHTML = activeGames.map((game) => {
    const teamA = teamById[game.teamA];
    const teamB = teamById[game.teamB];
    const status = game.status === 'final' ? 'Final' : 'Upcoming';
    const score = game.sets?.length
      ? game.sets.map((set) => `${set.a}-${set.b}`).join(' · ')
      : formatPreviewTime(game.startsAt);
    return `
      <article class="home-match">
        <div>
          <p class="home-match-time">${score}</p>
          <h4>${teamA.name} <span>vs</span> ${teamB.name}</h4>
          <p>${game.court}</p>
        </div>
        <span class="home-status home-status--${game.status}">${status}</span>
      </article>
    `;
  }).join('');
}

if (homeStandingsList) {
  homeStandingsList.innerHTML = buildStandingsPreview().slice(0, 6).map((team, index) => `
    <a class="home-standing-row" href="team.html?id=${team.id}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${team.name}</strong>
      <em>${team.wins}W</em>
    </a>
  `).join('');
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
const sponsorTierOrder = ['Official Partner', 'Co-presenter', 'Major Sponsor', 'Minor Sponsor'];
const sortedSponsors = [...SPONSORS].sort((a, b) =>
  sponsorTierOrder.indexOf(a.tier) - sponsorTierOrder.indexOf(b.tier) ||
  a.order - b.order ||
  a.name.localeCompare(b.name)
);
const sponsorMarkup = sortedSponsors.map((sponsor, index, list) => {
  const tierChanged = index === 0 || sponsor.tier !== list[index - 1].tier;
  return `
    ${tierChanged ? `<span class="marquee-tier">${sponsor.tier}</span>` : ''}
    <span class="marquee-item marquee-item--logo" title="${sponsor.name}">
      <img src="${sponsor.logo}" alt="${sponsor.name}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.style.display='inline';">
      <span class="marquee-fallback">${sponsor.name}</span>
    </span>
    <span class="marquee-sep">&#9670;</span>
  `;
}).join('');

document.querySelectorAll('[data-marquee]').forEach((track) => {
  track.innerHTML = sponsorMarkup + sponsorMarkup;
});

// ---- live state -------------------------------------------------------------
if (!isLive) {
  document.querySelectorAll('.live-dot').forEach((d) => { d.style.animation = 'none'; d.style.opacity = '.35'; });
}

// ---- nav: logo joins the bar past the hero ---------------------------------
const nav = document.getElementById('nav');
const hero = document.getElementById('hero');

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
const logoFlight = document.createElement('img');
logoFlight.className = 'logo-flight';
logoFlight.src = 'assets/hero-mvl-2026-logo.png';
logoFlight.alt = '';
logoFlight.setAttribute('aria-hidden', 'true');
document.body.appendChild(logoFlight);

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
    nav.classList.add('nav--stuck');
    nav.classList.add('hero-ready');
    nav.classList.add('logo-docked');
    logoFlight.classList.remove('is-active');
    return;
  }

  const rect = heroSequence.getBoundingClientRect();
  const travel = heroSequence.offsetHeight - window.innerHeight;
  const progress = travel > 0 ? clamp(-rect.top / travel) : 1;
  const isPinned = rect.top <= 0 && rect.bottom > window.innerHeight;
  heroSequence.classList.toggle('hero-is-pinned', isPinned);
  heroSequence.classList.toggle('hero-is-done', rect.bottom <= window.innerHeight);
  nav.classList.toggle('nav--stuck', rect.bottom <= window.innerHeight + 2);

  const rays = easeOut(progressBetween(progress, 0.02, 0.22));
  const star = easeOut(progressBetween(progress, 0.18, 0.42));
  const player = easeOut(progressBetween(progress, 0.38, 0.66));
  const logo = easeOut(progressBetween(progress, 0.62, 0.84));
  const copy = easeOut(progressBetween(progress, 0.78, 0.96));
  const logoHandoff = easeOut(progressBetween(progress, 0.976, 0.999));
  nav.classList.toggle('hero-ready', copy > .98);
  const isDocked = logoHandoff > .995 || rect.bottom <= window.innerHeight + 2;
  nav.classList.toggle('logo-docked', isDocked);

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

  if (heroLayers.logo && logoHandoff > 0 && logoHandoff < .995 && isPinned) {
    const logoRect = heroLayers.logo.getBoundingClientRect();
    const targetSize = window.innerWidth >= 960 ? 42 : (window.innerWidth <= 430 ? 30 : 34);
    const targetX = window.innerWidth >= 960 ? 48 : (window.innerWidth <= 430 ? 14 : 16);
    const targetY = (nav.offsetHeight - targetSize) / 2;
    const width = lerp(logoRect.width, targetSize * (logoRect.width / logoRect.height), logoHandoff);
    const height = lerp(logoRect.height, targetSize, logoHandoff);
    const x = lerp(logoRect.left, targetX, logoHandoff);
    const y = lerp(logoRect.top, targetY, logoHandoff);

    heroLayers.logo.classList.add('is-flight-hidden');
    nav.classList.remove('logo-docked');
    logoFlight.classList.add('is-active');
    Object.assign(logoFlight.style, {
      width: `${width.toFixed(1)}px`,
      height: `${height.toFixed(1)}px`,
      transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`,
    });
  } else {
    logoFlight.classList.remove('is-active');
    if (heroLayers.logo) {
      heroLayers.logo.classList.toggle('is-flight-hidden', isDocked);
    }
  }

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
    const travel = heroSequence.offsetHeight - window.innerHeight;
    const target = Math.max(0, Math.round(travel * 0.965));
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

// ---- save-the-dates action sheet -------------------------------------------
const sheet = document.getElementById('saveDatesSheet');
const sheetBtn = document.getElementById('saveDatesBtn');

if (sheet && sheetBtn && typeof sheet.showModal === 'function') {
  sheetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sheet.showModal();
  });

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) {
      sheet.close();
      return;
    }
    if (e.target === sheet) sheet.close();
  });
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
