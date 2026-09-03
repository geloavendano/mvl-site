/* ==========================================================================
   Photo galleries — /mvl/photos

   Every link is external (Pic-Time), so the page is a set of image previews
   over links that live in league-data.js. A tile whose url is still empty
   renders as a preview marked "coming soon" rather than vanishing, so the
   shape of the page is right before every gallery exists.
   ========================================================================== */
const { teams: TEAMS, games: GAMES = [], photos: PHOTOS = {} } = window.MVL_DATA;

const el = (id) => document.getElementById(id);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

const teamById = Object.fromEntries(TEAMS.map((team) => [team.id, team]));

const dayDate = (day) => {
  const game = GAMES.find((g) => g.day === day);
  if (!game) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
  }).format(new Date(game.startsAt));
};

// One tile shape for both rows. An external link opens in a new tab; a tile
// without a link is a <div>, so it is not focusable and cannot be clicked into
// a dead end.
const tile = ({ url, image, kicker, title, note, wide = false }) => {
  const inner = `
    <span class="photo-tile-media">
      <img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">
      <span class="photo-tile-scrim" aria-hidden="true"></span>
    </span>
    <span class="photo-tile-copy">
      ${kicker ? `<span class="photo-tile-kicker">${escapeHtml(kicker)}</span>` : ''}
      <span class="photo-tile-title">${escapeHtml(title)}</span>
      ${note ? `<span class="photo-tile-note">${escapeHtml(note)}</span>` : ''}
    </span>
    ${url ? '<span class="photo-tile-go" aria-hidden="true">&rarr;</span>'
          : '<span class="photo-tile-soon">Coming soon</span>'}
  `;
  const cls = `photo-tile${wide ? ' photo-tile--wide' : ''}${url ? '' : ' is-empty'}`;
  return url
    ? `<a class="${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
};

// ---- headline gallery ---------------------------------------------------------
const hero = PHOTOS.gallery || {};
const heroLink = el('photosHeroLink');
el('photosHeroTitle').textContent = hero.label || 'MVL 2026 photos';
el('photosHeroNote').textContent = hero.note || '';
if (hero.image) el('photosHeroImg').src = hero.image;
if (hero.url) {
  heroLink.href = hero.url;
  heroLink.target = '_blank';
  heroLink.rel = 'noopener';
} else {
  // No gallery yet: keep the banner, drop the link rather than offer a dead one.
  heroLink.removeAttribute('href');
  heroLink.classList.add('is-empty');
  el('photosHeroCta').textContent = 'Coming soon';
}

// ---- per day ------------------------------------------------------------------
el('photosDays').innerHTML = (PHOTOS.days || []).map((entry) => tile({
  url: entry.url,
  image: entry.image || '/mvl/assets/mvl-hero-still.jpg',
  kicker: dayDate(entry.day),
  title: `Day ${entry.day}`,
})).join('');

// ---- per team -----------------------------------------------------------------
el('photosTeams').innerHTML = (PHOTOS.teams || []).map((entry) => {
  const team = teamById[entry.id];
  if (!team) return '';
  return tile({
    url: entry.url,
    image: entry.image || `/mvl/assets/teams/roster/${entry.id}.webp`,
    title: team.name,
    note: team.tag || '',
  });
}).join('');
