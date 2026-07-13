/* ==========================================================================
   MVL 2026 — Phase 1 teaser page
   Reveal-on-scroll + the Save-the-Dates action sheet.
   ========================================================================== */

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
  el.style.setProperty('--d', `${(i % 4) * 70}ms`);
  revealObserver.observe(el);
});

// ---- save-the-dates action sheet ---------------------------------------------
// The trigger's href points straight at the .ics, so it still saves the dates
// with JS disabled or where <dialog> is unsupported.
const sheet = document.getElementById('saveDatesSheet');
const sheetBtn = document.getElementById('saveDatesBtn');

if (sheet && sheetBtn && typeof sheet.showModal === 'function') {
  sheetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sheet.showModal();
  });

  // any option (or Cancel) closes the sheet; the option's own href still runs
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) {
      sheet.close();
      return;
    }
    // click on the ::backdrop registers on the dialog itself
    if (e.target === sheet) sheet.close();
  });
}
