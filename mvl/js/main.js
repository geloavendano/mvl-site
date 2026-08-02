/* ==========================================================================
   MVL 2026 — Phase 2 landing page
   Content lives in the data arrays below; layout never needs touching
   to update teams / sponsors / games.
   ========================================================================== */

// ---- state ---------------------------------------------------------------
// ---- data ----------------------------------------------------------------
const { teams: TEAMS, sponsors: SPONSORS, games: GAMES, livestream, titlePresenter: TITLE_PRESENTER } = window.MVL_DATA;
const isLive = Boolean(livestream.isLive);
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
  const bentoSizes = [
    'team-card--bento-hero',
    'team-card--bento-tall',
    'team-card--bento-wide',
    'team-card--bento-compact',
    'team-card--bento-compact',
    'team-card--bento-wide',
    'team-card--bento-tall',
    'team-card--bento-compact',
  ];
  for (let i = bentoSizes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bentoSizes[i], bentoSizes[j]] = [bentoSizes[j], bentoSizes[i]];
  }
  // Teams with artwork use it as the card background; the CSS oval/shard
  // decoration is suppressed for those since the artwork already carries it.
  teamsGrid.innerHTML = TEAMS.map((team, i) => `
  <article class="team-card reveal${team.bg ? ' team-card--art' : ''} ${bentoSizes[i % bentoSizes.length]}"
           style="--team-a:${team.grad[0]}; --team-b:${team.grad[1]}; ${team.bg ? `--team-art:url('${team.bg}'); ` : ''}--oval-x:${ovalPositions[i % ovalPositions.length][0]}; --oval-y:${ovalPositions[i % ovalPositions.length][1]}; --oval-rot:${ovalPositions[i % ovalPositions.length][2]}; --d:${(i % 4) * 55}ms">
    <div class="team-card-oval" aria-hidden="true"></div>
    <div class="team-card-player-slot" aria-hidden="true"></div>
    <div class="team-card-photo" aria-hidden="true"></div>
    <div class="team-card-shards" aria-hidden="true"></div>
    <div class="team-card-copy">
      <h3 class="team-card-name">${team.name}</h3>
    </div>
  </article>
  `).join('');
}

// ---- render: livestream ----------------------------------------------------
document.querySelectorAll('[data-livestream-link]').forEach((link) => {
  if (isLive) {
    link.href = livestream.youtubeUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.innerHTML = '<span class="live-dot" aria-hidden="true"></span> Watch the Livestream';
  } else {
    link.href = '/mvl/schedule.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.textContent = 'View the Schedule';
  }
});

const liveEmbed = document.getElementById('liveEmbed');
const gamesLive = document.querySelector('.games-live');
const gamesGrid = document.querySelector('.games-grid');
if (!isLive) {
  gamesLive?.classList.add('is-hidden');
  gamesGrid?.classList.add('is-offline');
} else if (liveEmbed && livestream.youtubeId) {
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
    ? [{ youtubeId: game.youtubeId, label: game.videoLabel || 'Full Game', duration: game.duration || '' }]
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

// ---- render: sponsor marquees (unit repeated for the seamless loop) --------
// Each strip declares which tier it shows via data-marquee. "all" runs the
// full roster led by the title presenter; a tier name shows just that tier.
const sponsorTierOrder = ['Official Partner', 'Co-presenter', 'Major Sponsor', 'Minor Sponsor'];
const sortedSponsors = [...SPONSORS].sort((a, b) =>
  sponsorTierOrder.indexOf(a.tier) - sponsorTierOrder.indexOf(b.tier) ||
  a.order - b.order ||
  a.name.localeCompare(b.name)
);

// not lazy-loaded: the track is overflow:hidden, so a lazy image parked outside
// the clip would never intersect the viewport and never load.
const sponsorChip = (sponsor) => `
    <span class="marquee-item marquee-item--logo${sponsor.logoBg ? ` marquee-item--bg-${sponsor.logoBg}` : ''}" title="${sponsor.name}">
      <img src="${sponsor.logo}" alt="${sponsor.name}" onerror="this.hidden=true;this.nextElementSibling.style.display='inline';">
      <span class="marquee-fallback">${sponsor.name}</span>
    </span>
    <span class="marquee-sep">&#9670;</span>
  `;

const buildMarquee = (filter) => {
  const showAll = !filter || filter === 'all';
  const list = showAll ? sortedSponsors : sortedSponsors.filter((s) => s.tier === filter);
  if (!list.length) return '';

  // the full strip opens with the title presenter
  let markup = '';
  if (showAll && TITLE_PRESENTER) {
    markup += `
      <span class="marquee-tier">Presented by</span>
      ${sponsorChip(TITLE_PRESENTER)}`;
  }
  // a single-tier strip is labelled once at the head of each loop; the full
  // strip labels every tier as it changes
  if (!showAll) markup += `<span class="marquee-tier">${filter}</span>`;
  markup += list.map((sponsor, index, arr) => {
    const tierChanged = showAll && (index === 0 || sponsor.tier !== arr[index - 1].tier);
    return `${tierChanged ? `<span class="marquee-tier">${sponsor.tier}</span>` : ''}${sponsorChip(sponsor)}`;
  }).join('');
  return markup;
};

// the unit is one pass of the tier; setupMarquee repeats it as many times as
// the strip needs to stay seamless (a short tier like Minor Sponsor repeats a
// lot more than a twelve-logo one).
const marqueeUnits = new WeakMap();

document.querySelectorAll('[data-marquee]').forEach((track) => {
  const markup = buildMarquee(track.dataset.marquee);
  if (!markup) {
    // nothing in this tier — drop the strip rather than leave an empty bar
    track.closest('.marquee')?.remove();
    return;
  }
  marqueeUnits.set(track, markup);
  track.innerHTML = markup;
});

// Auto-panning sponsor strip. It pans left on its own, holds while the cursor
// is over it, and follows a drag or touch — releasing resumes the pan from
// wherever the user left it. Position is a plain unbounded number applied as a
// transform, so the wrap is a modulo and works in both directions; a scroll
// container would clamp at 0 and stop a backwards drag dead.
const marqueeReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MARQUEE_SPEED = 36; // px per second, time-based so 60Hz and 120Hz match

const setupMarquee = (marquee) => {
  const track = marquee.querySelector('[data-marquee]');
  const unit = marqueeUnits.get(track);
  if (!track || !unit) return;
  track.querySelectorAll('img').forEach((img) => { img.draggable = false; });

  let pos = 0;
  let unitWidth = 0;
  let copies = 1;

  // Enough copies that the visible window is always covered: the offset stays
  // inside one unit, so the strip must be at least a unit wider than the frame.
  // A tier with only a handful of logos gets extra passes on top of that, so
  // there is something to pan through rather than the same three marks.
  const measure = () => {
    const width = track.scrollWidth / copies;
    if (!width) return;
    const perUnit = track.querySelectorAll('.marquee-item--logo').length / copies;
    const needed = Math.max(
      perUnit < 6 ? 5 : 2,
      Math.ceil(marquee.clientWidth / width) + 2
    );
    if (needed > copies) {
      track.insertAdjacentHTML('beforeend', unit.repeat(needed - copies));
      track.querySelectorAll('img').forEach((img) => { img.draggable = false; });
      copies = needed;
    }
    unitWidth = track.scrollWidth / copies;
  };

  const render = () => {
    if (unitWidth > 0) pos = ((pos % unitWidth) + unitWidth) % unitWidth;
    track.style.transform = `translate3d(${-pos}px, 0, 0)`;
  };

  measure();
  // logo widths are unknown until they decode, so re-measure as they arrive
  track.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', measure, { once: true });
  });
  window.addEventListener('resize', measure);

  let hovering = false;
  let dragging = false;
  let dragStartX = 0;
  let dragStartPos = 0;

  marquee.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hovering = true;
  });
  marquee.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hovering = false;
  });
  marquee.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartPos = pos;
    marquee.classList.add('is-dragging');
    // capture keeps the drag alive past the strip's edges; it throws if the
    // pointer is already gone, which just means there is nothing to capture
    try { marquee.setPointerCapture(e.pointerId); } catch { /* no active pointer */ }
  });
  marquee.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    pos = dragStartPos - (e.clientX - dragStartX);
    render();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    // a touch that lifts leaves no cursor behind, so the pan resumes at once
    if (e.pointerType !== 'mouse') hovering = false;
    marquee.classList.remove('is-dragging');
  };
  marquee.addEventListener('pointerup', endDrag);
  marquee.addEventListener('pointercancel', endDrag);

  let lastTime = 0;
  const tick = (now) => {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .1) : 0;
    lastTime = now;
    if (!hovering && !dragging && !marqueeReduceMotion) {
      pos += MARQUEE_SPEED * dt;
      render();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

document.querySelectorAll('.marquee').forEach(setupMarquee);

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
