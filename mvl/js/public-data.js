(async () => {
  const fallback = window.MVL_DATA;
  const config = window.MVL_SUPABASE;
  const loaderScript = document.currentScript;
  const entry = loaderScript.dataset.entry;
  const version = loaderScript.dataset.version || '';
  const normalizeLivestream = (managed = {}, fallbackLivestream = {}) => {
    const fallbackStreams = Array.isArray(fallbackLivestream.streams) ? fallbackLivestream.streams : [];
    const managedStreams = Array.isArray(managed.streams) ? managed.streams : [];
    const streams = ['Court 1', 'Court 2'].map((court, index) => {
      const stream = managedStreams[index] || (index === 0 ? managed : {}) || {};
      const fallbackStream = fallbackStreams[index] || {};
      return {
        court,
        youtubeUrl: stream.youtube_url || stream.youtubeUrl || fallbackStream.youtubeUrl || fallbackLivestream.youtubeUrl || 'https://www.youtube.com/@metaricevolley',
        youtubeId: stream.youtube_id || stream.youtubeId || fallbackStream.youtubeId || '',
        isLive: Boolean(stream.is_live ?? stream.isLive ?? fallbackStream.isLive),
      };
    });
    const primary = streams.find((stream) => stream.isLive) || streams[0];
    return {
      streams,
      youtubeUrl: primary.youtubeUrl,
      youtubeId: primary.youtubeId,
      isLive: streams.some((stream) => stream.isLive),
    };
  };
  const normalizeGames = (games = []) => games.map((game) => {
    const videos = Array.isArray(game.videos) && game.videos.length
      ? game.videos
      : (/^[A-Za-z0-9_-]{11}$/.test(game.youtubeId || '') ? [{
          youtubeId: game.youtubeId,
          label: game.videoLabel || 'Live Replay',
          duration: game.duration || '',
        }] : []);
    return {
      ...game,
      videos,
      youtubeId: videos[0]?.youtubeId || '',
      videoLabel: videos[0]?.label || '',
      duration: videos[0]?.duration || '',
    };
  });
  // Every JS-rendered section on the page — teams, standings, schedule,
  // videos — comes from the entry script below, and it is only appended once
  // this fetch settles. fetch() has no timeout of its own, so a request that
  // hangs rather than fails (flaky mobile data, captive portal, a carrier
  // stalling the connection) never settles and the page is left showing
  // nothing but its static headings. The abort turns that into the same
  // bundled-data fallback as any other failure.
  // The bundled data in league-data.js is the pre-tournament fixture list: a
  // handful of games and no videos at all. Falling straight back to it turns
  // one slow request into a page that looks like the season never happened —
  // which is exactly how it looked on a phone. So the last good response is
  // kept and preferred over the bundle: a device that has loaded the site
  // before shows the real season even when the request fails.
  const CACHE_KEY = 'mvl.publicData.v1';
  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const writeCache = (payload) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), payload })); }
    catch { /* private mode or full quota — the page works either way */ }
  };

  // fetch() has no timeout of its own, so a request that hangs rather than
  // fails (flaky mobile data, a captive portal, a carrier stalling the
  // connection) would never settle. One retry: the common failure at a venue
  // is a single dropped request, not a dead network.
  const attempt = async (ms) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(`${config.url}/rest/v1/rpc/mvl_get_public_data`, {
        method: 'POST',
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const apply = (managed) => {
    window.MVL_DATA = {
      ...fallback,
      livestream: normalizeLivestream(managed.livestream, fallback.livestream),
      // bundled voting copy (the deadline label) plus the live open/closed flag
      voting: { ...fallback.voting, ...(managed.voting || {}) },
      games: normalizeGames(managed.games?.length ? managed.games : fallback.games),
    };
  };

  try {
    let managed;
    try {
      managed = await attempt(6000);
    } catch (first) {
      console.warn('MVL data: first attempt failed, retrying', first);
      managed = await attempt(9000);
    }
    apply(managed);
    writeCache(managed);
  } catch (error) {
    const cached = readCache();
    if (cached?.payload) {
      const age = Math.round((Date.now() - (cached.at || 0)) / 60000);
      console.warn(`MVL data: request failed, using the last good copy (${age} min old)`, error);
      apply(cached.payload);
    } else {
      console.warn('Using bundled MVL data:', error);
      window.MVL_DATA = {
        ...fallback,
        livestream: normalizeLivestream({}, fallback.livestream),
        games: normalizeGames(fallback.games),
      };
    }
  } finally {
    // in `finally` so the page still renders even if the fallback path throws
    const script = document.createElement('script');
    script.src = `/mvl/js/${entry}.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
    document.body.appendChild(script);
  }
})();
