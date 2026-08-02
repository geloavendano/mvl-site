(() => {
  const site = window.MVL_SITE || {};
  const measurementId = (site.gaMeasurementId || '').trim();
  const isLocalPreview = location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';

  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;
  if (isLocalPreview && site.analyticsDebug !== true) return;
  if (navigator.doNotTrack === '1') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_title: document.title,
    page_path: location.pathname + location.search,
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || typeof window.gtag !== 'function') return;

    const url = new URL(link.href, location.href);
    const isOutbound = url.origin !== location.origin;
    const isCalendar = url.hostname.includes('calendar.google.com') ||
      url.pathname.endsWith('.ics');
    const isCta = link.classList.contains('cta') ||
      link.classList.contains('teaser-save-dates') ||
      link.classList.contains('hero-calendar-link') ||
      link.classList.contains('sheet-option');

    if (!isOutbound && !isCalendar && !isCta) return;

    window.gtag('event', isCalendar ? 'calendar_click' : (isCta ? 'cta_click' : 'outbound_click'), {
      link_url: link.href,
      link_text: link.textContent.trim().replace(/\s+/g, ' ').slice(0, 120),
      page_path: location.pathname + location.search,
    });
  });
})();
