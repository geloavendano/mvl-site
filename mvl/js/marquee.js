/* ==========================================================================
   Sponsor marquee — shared by the gameday landing and the teaser.
   Reads window.MVL_DATA.sponsors / titlePresenter, so it only needs
   league-data.js ahead of it. Lifted out of main.js, which is otherwise
   gametime-only and would throw on any other page.
   ========================================================================== */
const { sponsors: SPONSORS, titlePresenter: TITLE_PRESENTER } = window.MVL_DATA;

// ---- render: sponsor marquees (unit repeated for the seamless loop) --------
// Each strip declares which tier it shows via data-marquee. "all" runs the
// full roster led by the title presenter; a tier name shows just that tier.
const sponsorTierOrder = ['Powered by', 'Official Partners', 'Co-Presenters', 'Major Sponsors', 'Minor Sponsors'];
const sortedSponsors = [...SPONSORS].sort((a, b) =>
  sponsorTierOrder.indexOf(a.tier) - sponsorTierOrder.indexOf(b.tier) ||
  a.order - b.order ||
  a.name.localeCompare(b.name)
);

// not lazy-loaded: the track is overflow:hidden, so a lazy image parked outside
// the clip would never intersect the viewport and never load.
const sponsorChip = (sponsor, { sep = true, tight = false } = {}) => `
    <span class="marquee-item marquee-item--logo${sponsor.logoBg ? ` marquee-item--bg-${sponsor.logoBg}` : ''}${tight ? ' marquee-item--tight' : ''}" title="${sponsor.name}">
      <img src="${sponsor.logo}" alt="${sponsor.name}" onerror="this.hidden=true;this.nextElementSibling.style.display='inline';">
      <span class="marquee-fallback">${sponsor.name}</span>
    </span>${sep ? `
    <span class="marquee-sep">&#9670;</span>` : ''}
  `;

// A strip can carry more than one tier. Converge sits in its own "Powered by"
// tier so it can be labelled separately, but it belongs on the partners strip
// rather than getting a band of its own.
const marqueeTierGroups = {
  'Official Partners': ['Powered by', 'Official Partners'],
};

const buildMarquee = (filter) => {
  const showAll = !filter || filter === 'all';
  const tiers = showAll ? sponsorTierOrder : (marqueeTierGroups[filter] || [filter]);
  const list = sortedSponsors.filter((s) => tiers.includes(s.tier));
  if (!list.length) return '';

  // The title presenter outranks every tier, so it leads the full roster and
  // whichever strip opens the tier order — today the partners strip, which
  // carries 'Powered by'. Deriving it from sponsorTierOrder rather than naming
  // the strip means a tier reshuffle keeps the presenter at the front.
  let markup = '';
  if (TITLE_PRESENTER && (showAll || tiers.includes(sponsorTierOrder[0]))) {
    markup += `
      <span class="marquee-tier">Presented by</span>
      ${sponsorChip(TITLE_PRESENTER)}`;
  }
  // every tier is labelled at the head of its own run, so a strip carrying one
  // tier gets a single label per loop and a strip carrying several gets each
  markup += list.map((sponsor, index, arr) => {
    const tierChanged = index === 0 || sponsor.tier !== arr[index - 1].tier;
    // A `group` runs its members together as one cluster: no diamond between
    // them and a tighter gap, so a brand house reads as one sponsor rather than
    // several unrelated ones. The separator returns after the last member.
    const runsInto = Boolean(sponsor.group && arr[index + 1]?.group === sponsor.group);
    const runsFrom = Boolean(sponsor.group && index > 0 && arr[index - 1].group === sponsor.group);
    return `${tierChanged ? `<span class="marquee-tier">${sponsor.tier}</span>` : ''}${sponsorChip(sponsor, { sep: !runsInto, tight: runsFrom })}`;
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

  // A trackpad two-finger swipe never becomes a pointer drag — it arrives as a
  // wheel event with deltaX. Claim it only when the gesture is mostly
  // horizontal, so a vertical scroll that happens to pass over the strip still
  // scrolls the page. preventDefault also stops the horizontal overscroll that
  // browsers turn into a back-navigation.
  let wheeling = false;
  let wheelTimer = 0;
  marquee.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    wheeling = true;
    pos += e.deltaX;
    render();
    window.clearTimeout(wheelTimer);
    // wheel has no gesture-end event, so resume once the deltas stop arriving
    wheelTimer = window.setTimeout(() => { wheeling = false; }, 160);
  }, { passive: false });

  let lastTime = 0;
  const tick = (now) => {
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .1) : 0;
    lastTime = now;
    if (!hovering && !dragging && !wheeling && !marqueeReduceMotion) {
      pos += MARQUEE_SPEED * dt;
      render();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

document.querySelectorAll('.marquee').forEach(setupMarquee);
