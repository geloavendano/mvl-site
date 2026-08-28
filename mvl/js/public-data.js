(async () => {
  const fallback = window.MVL_DATA;
  const config = window.MVL_SUPABASE;
  const loaderScript = document.currentScript;
  const entry = loaderScript.dataset.entry;
  const version = loaderScript.dataset.version || '';
  const normalizeLivestream = (managed = {}, fallbackLivestream = {}) => {
    const fallbackStreams = Array.isArray(fallbackLivestream.streams) ? fallbackLivestream.streams : [];
    const managedStreams = Array.isArray(managed.streams) ? managed.streams : [];
    const streams = ['Left Court', 'Right Court'].map((court, index) => {
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
          label: game.videoLabel || 'Full Game',
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/mvl_get_public_data`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const managed = await response.json();
    window.MVL_DATA = {
      ...fallback,
      livestream: normalizeLivestream(managed.livestream, fallback.livestream),
      games: normalizeGames(managed.games?.length ? managed.games : fallback.games),
    };
  } catch (error) {
    console.warn('Using bundled MVL data:', error);
    window.MVL_DATA = {
      ...fallback,
      livestream: normalizeLivestream({}, fallback.livestream),
      games: normalizeGames(fallback.games),
    };
  } finally {
    // in `finally` so the page still renders even if the fallback path throws
    clearTimeout(timeout);
    const script = document.createElement('script');
    script.src = `/mvl/js/${entry}.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
    document.body.appendChild(script);
  }
})();
