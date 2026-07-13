/* ==========================================================================
   MVL 2026 — Phase 1 teaser page
   No nav, no data arrays — just the reveal-on-scroll used across the site.
   ========================================================================== */

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.setProperty('--d', `${(i % 4) * 70}ms`);
  revealObserver.observe(el);
});
