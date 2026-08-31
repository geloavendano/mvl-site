/* ==========================================================================
   MVL 2026 — Phase 2 landing page
   Content lives in the data arrays below; layout never needs touching
   to update teams / sponsors / games.
   ========================================================================== */

// ---- state ---------------------------------------------------------------
// ---- data ----------------------------------------------------------------
const { teams: TEAMS, games: GAMES, livestream } = window.MVL_DATA;
const validLivestreamId = (value) => /^[A-Za-z0-9_-]{11}$/.test(value || '');
const activeLivestreams = (livestream.streams || [])
  .filter((stream) => stream.isLive && validLivestreamId(stream.youtubeId))
  .sort((a, b) => a.court.localeCompare(b.court));
const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
const playoffGameIds = new Set(['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'bronze', 'final']);
const gameTeam = (game, side) => {
  const id = side === 'A' ? game.teamA : game.teamB;
  const label = side === 'A' ? game.teamALabel : game.teamBLabel;
  return { ...(teamById[id] || { id, grad: ['#4338CA', '#16104A'] }), name: label || teamById[id]?.name || 'TBD' };
};

// ---- render: team cards ----------------------------------------------------
const teamsGrid = document.getElementById('teamsGrid');
if (teamsGrid) {
  const ovalPositions = [
    ['-18%', '12%', '-16deg'],
    ['42%', '-18%', '18deg'],
    ['18%', '54%', '-24deg'],
    ['58%', '18%', '26deg'],
    ['-12%', '48%', '14deg'],
    ['48%', '44%', '-18deg'],
    ['8%', '-14%', '22deg'],
    ['62%', '58%', '-28deg'],
  ];
  // Teams with artwork use it as the card background; the CSS oval/shard
  // decoration is suppressed for those since the artwork already carries it.
  // The grid is uniform (2 / 4 / 8 across), so there are no per-card size
  // classes to shuffle any more — every card gets the same frame.
  teamsGrid.innerHTML = TEAMS.map((team, i) => `
  <article class="team-card reveal${team.bg ? ' team-card--art' : ''}"
           style="--team-a:${team.grad[0]}; --team-b:${team.grad[1]}; ${team.bg ? `--team-art:url('${team.bg}'); ` : ''}--oval-x:${ovalPositions[i % ovalPositions.length][0]}; --oval-y:${ovalPositions[i % ovalPositions.length][1]}; --oval-rot:${ovalPositions[i % ovalPositions.length][2]}; --d:${(i % 4) * 55}ms">
    <div class="team-card-oval" aria-hidden="true"></div>
    <div class="team-card-player-slot" aria-hidden="true">${team.photo ? `<img class="team-card-player" src="${team.photo}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <div class="team-card-photo" aria-hidden="true"></div>
    <div class="team-card-shards" aria-hidden="true"></div>
    <div class="team-card-copy">
      <h3 class="team-card-name">${team.name}</h3>
    </div>${team.roster ? `
    <button class="team-card-hit" type="button"
            data-roster="${team.roster}" data-roster-label="${team.name} roster">
      <span class="sr-only">View the ${team.name} roster</span>
    </button>` : ''}
  </article>
  `).join('');
}

// ---- roster reveal lightbox -------------------------------------------------
// Same component as the prize posters on the check-in page (see lightbox.js).
const rosterLightbox = window.createLightbox?.({
  dialog: document.getElementById('rosterLightbox'),
  img: document.getElementById('rosterLightboxImg'),
  stage: document.getElementById('rosterLightboxStage'),
  hint: document.getElementById('rosterLightboxHint'),
  fitHint: 'Tap the roster to zoom',
});

teamsGrid?.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-roster]');
  if (!trigger) return;
  rosterLightbox?.open(trigger.dataset.roster, trigger.dataset.rosterLabel || '');
});

// ---- fit: team names to their rail -----------------------------------------
// The rail length varies per bento slot, so no single font-size fits every
// card — "Gizmo Spikers" outruns the short slots while "S24" leaves most of a
// tall one empty. Scale any name that overruns down to its rail, leaving the
// rest at the size the stylesheet picked.
const fitTeamNames = () => {
  document.querySelectorAll('.team-card--art .team-card-name').forEach((name) => {
    const rail = name.parentElement;
    if (!rail) return;
    name.style.fontSize = '';
    const railStyle = getComputedStyle(rail);
    const room = rail.clientHeight
      - parseFloat(railStyle.paddingTop)
      - parseFloat(railStyle.paddingBottom);
    const needed = name.getBoundingClientRect().height;
    if (!room || !needed || needed <= room) return;
    const base = parseFloat(getComputedStyle(name).fontSize);
    // a hair under the exact ratio so rounding never leaves a clipped glyph
    name.style.fontSize = `${Math.max(9, base * (room / needed) * 0.97)}px`;
  });
};

// STRRETCH loads async and is far narrower than the fallback, so the first
// measurement would be against the wrong metrics.
if (document.fonts?.ready) document.fonts.ready.then(fitTeamNames);
fitTeamNames();

let fitTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(fitTeamNames, 120);
});

// ---- render: livestream ----------------------------------------------------
document.querySelectorAll('[data-livestream-link]').forEach((link) => {
  if (activeLivestreams.length) {
    // Straight to /mvl/videos, which plays every live court on the page. This
    // used to send a single court to YouTube and two courts to a picker sheet —
    // an extra tap to reach a page that already shows both.
    link.href = '/mvl/videos.html';
    link.innerHTML = '<span class="live-dot" aria-hidden="true"></span> Watch the Livestream';
    link.removeAttribute('target');
    link.removeAttribute('rel');
  } else {
    link.href = '/mvl/schedule.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.textContent = 'View the Schedule';
  }
});

const liveStreams = document.getElementById('liveStreams');
const gamesLive = document.querySelector('.games-live');
const gamesGrid = document.querySelector('.games-grid');
if (!activeLivestreams.length) {
  gamesLive?.classList.add('is-hidden');
  gamesGrid?.classList.add('is-offline');
} else if (liveStreams) {
  liveStreams.classList.toggle('has-two-streams', activeLivestreams.length > 1);
  liveStreams.innerHTML = activeLivestreams.map((stream) => `
    <article class="live-court">
      <p>${stream.court}</p>
      <div class="live-frame">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${stream.youtubeId}?autoplay=1&mute=1"
          title="MVL livestream · ${stream.court}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen></iframe>
      </div>
    </article>
  `).join('');
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
    !playoffGameIds.has(game.id) &&
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
  const chronologicalGames = [...GAMES].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const todayGames = chronologicalGames.filter((game) => dateKey(new Date(game.startsAt)) === today);
  const nextGame = chronologicalGames.find((game) => new Date(game.startsAt) >= now) || chronologicalGames.at(-1);
  const activeKey = todayGames.length ? today : dateKey(new Date(nextGame.startsAt));
  const activeGames = chronologicalGames
    .filter((game) => dateKey(new Date(game.startsAt)) === activeKey)
    .sort((a, b) => (a.gameOrder || 999) - (b.gameOrder || 999) || new Date(a.startsAt) - new Date(b.startsAt));

  homeScheduleTitle.textContent = todayGames.length
    ? `Today · ${formatPreviewDate(activeGames[0].startsAt)}`
    : `Next Games · ${formatPreviewDate(activeGames[0].startsAt)}`;

  homeScheduleList.innerHTML = activeGames.map((game) => {
    const teamA = gameTeam(game, 'A');
    const teamB = gameTeam(game, 'B');
    const status = game.status === 'final' ? 'Final' : 'Upcoming';
    const score = game.sets?.length
      ? game.sets.map((set) => `${set.a}-${set.b}`).join(' · ')
      : formatPreviewTime(game.startsAt);
    return `
      <article class="home-match">
        <div>
          <p class="home-match-time">${score}</p>
          <h4><span class="home-match-team"><span class="standing-team-mark" style="--team-a:${teamA.grad[0]}; --team-b:${teamA.grad[1]}"></span>${teamA.name}</span> <span class="home-match-vs">vs</span> <span class="home-match-team"><span class="standing-team-mark" style="--team-a:${teamB.grad[0]}; --team-b:${teamB.grad[1]}"></span>${teamB.name}</span></h4>
          <p>${game.court}</p>
        </div>
        <span class="home-status home-status--${game.status}">${status}</span>
      </article>
    `;
  }).join('');
}

if (homeStandingsList) {
  homeStandingsList.innerHTML = buildStandingsPreview().map((team, index) => `
    <div class="home-standing-row">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong><span class="standing-team-mark" style="--team-a:${team.grad[0]}; --team-b:${team.grad[1]}"></span>${team.name}</strong>
      <em>${team.wins}<i>W</i>&thinsp;-&thinsp;${team.losses}<i>L</i></em>
    </div>
  `).join('');
}

// ---- render: past game cards ----------------------------------------------
// ---- render: recent game videos --------------------------------------------
// Only games that actually have a playable recording, newest first, capped at
// six. Cards are click-to-play embeds, matching the Videos library.
const validYouTubeId = (value) => typeof value === 'string' && /^[\w-]{11}$/.test(value.trim());

const gameVideos = (game) => {
  if (Array.isArray(game.videos)) return game.videos.filter((v) => validYouTubeId(v.youtubeId));
  return validYouTubeId(game.youtubeId)
    ? [{ youtubeId: game.youtubeId, label: game.videoLabel || 'Live Replay', duration: game.duration || '' }]
    : [];
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[c]));

const recentVideos = [...GAMES]
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
  .flatMap((game) => gameVideos(game).map((video, index) => ({ game, video, index })))
  .slice(0, 6);

const recentVideosEl = document.getElementById('recentVideos');
const recentVideosEmpty = document.getElementById('recentVideosEmpty');

if (recentVideosEl) {
  recentVideosEmpty?.classList.toggle('is-hidden', recentVideos.length > 0);
  recentVideosEl.innerHTML = recentVideos.map(({ game, video, index }) => {
    const teamA = gameTeam(game, 'A');
    const teamB = gameTeam(game, 'B');
    const label = video.label || `Video ${index + 1}`;
    return `
      <article class="home-video-card reveal">
        <div class="home-video-player">
          <button type="button" data-play-video="${video.youtubeId}" data-video-label="${escapeHtml(label)}"
                  aria-label="Play ${escapeHtml(label)}: ${escapeHtml(teamA.name)} versus ${escapeHtml(teamB.name)}">
            <img src="https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg" alt="" loading="lazy">
            <span class="play-btn play-btn--sm" aria-hidden="true"></span>
          </button>
        </div>
        <p class="video-title">
          <span class="home-match-team"><span class="standing-team-mark" style="--team-a:${teamA.grad[0]}; --team-b:${teamA.grad[1]}"></span>${escapeHtml(teamA.name)}</span>
          <span class="home-match-vs">vs</span>
          <span class="home-match-team"><span class="standing-team-mark" style="--team-a:${teamB.grad[0]}; --team-b:${teamB.grad[1]}"></span>${escapeHtml(teamB.name)}</span>
        </p>
        <p class="video-meta">${escapeHtml(label)}${video.duration ? ` &middot; ${escapeHtml(video.duration)}` : ''}</p>
      </article>
    `;
  }).join('');

  recentVideosEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-play-video]');
    if (!button) return;
    const videoId = button.dataset.playVideo;
    if (!validYouTubeId(videoId)) return;
    button.outerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1"
        title="${escapeHtml(button.dataset.videoLabel || 'MVL game video')}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe>
    `;
  });
}


// ---- live state -------------------------------------------------------------
if (!activeLivestreams.length) {
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
  presenter: document.querySelector('[data-hero-layer="presenter"]'),
};
const heroCopy = document.querySelector('[data-hero-copy]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const logoFlight = document.createElement('img');
logoFlight.className = 'logo-flight';
logoFlight.src = '/mvl/assets/hero-mvl-2026-logo.png';
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
  // the title presenter lands just behind the MVL mark
  const presenter = easeOut(progressBetween(progress, 0.72, 0.90));
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
  setLayer(heroLayers.presenter, {
    '--layer-opacity': presenter,
    '--layer-x': '0px',
    '--layer-y': `${lerp(-14, 0, presenter).toFixed(1)}px`,
    '--layer-scale': lerp(.92, 1, presenter).toFixed(3),
    '--layer-rotate': '0deg',
    '--layer-blur': `${lerp(5, 0, presenter).toFixed(1)}px`,
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

// intro auto-scroll runs on EVERY page load (client request), not just the first visit
if (heroSequence && !reduceMotion) {
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
