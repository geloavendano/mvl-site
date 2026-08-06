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

  // Which calendar a link actually adds the dates to. The Google links carry
  // the weekend in their `dates` range, so the two weekends stay separable
  // without anyone having to read a URL in the reports.
  const calendarTarget = (url) => {
    if (url.pathname.endsWith('.ics')) return 'device';
    if (url.search.includes('20260829')) return 'google_weekend_1';
    if (url.search.includes('20260905')) return 'google_weekend_2';
    return 'google';
  };

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

    const common = {
      link_url: link.href,
      link_text: link.textContent.trim().replace(/\s+/g, ' ').slice(0, 120),
      page_path: location.pathname + location.search,
    };

    if (isCalendar) {
      // The Save the Dates trigger points at the .ics so it still works without
      // JS, but where <dialog> is supported the script swallows the click and
      // opens the picker instead. That prevented click saved nothing, so
      // counting it as a save both double-counted anyone who went on to pick a
      // calendar and counted everyone who opened the sheet and cancelled.
      // defaultPrevented is exactly the "the href never ran" signal, and it is
      // already set by the time this document-level listener sees the event.
      if (event.defaultPrevented) {
        window.gtag('event', 'calendar_picker_open', common);
        return;
      }
      window.gtag('event', 'calendar_save', {
        ...common,
        calendar_target: calendarTarget(url),
      });
      return;
    }

    window.gtag('event', isCta ? 'cta_click' : 'outbound_click', common);
  });
})();
