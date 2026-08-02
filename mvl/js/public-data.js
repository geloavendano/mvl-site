(async () => {
  const fallback = window.MVL_DATA;
  const config = window.MVL_SUPABASE;
  const loaderScript = document.currentScript;
  const entry = loaderScript.dataset.entry;
  const version = loaderScript.dataset.version || '';
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
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/mvl_get_public_data`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const managed = await response.json();
    window.MVL_DATA = {
      ...fallback,
      livestream: {
        youtubeUrl: managed.livestream?.youtube_url || fallback.livestream.youtubeUrl,
        youtubeId: managed.livestream?.youtube_id || '',
        isLive: Boolean(managed.livestream?.is_live),
      },
      games: normalizeGames(managed.games?.length ? managed.games : fallback.games),
    };
  } catch (error) {
    console.warn('Using bundled MVL data:', error);
    window.MVL_DATA = {
      ...fallback,
      games: normalizeGames(fallback.games),
    };
  }
  const script = document.createElement('script');
  script.src = `/mvl/js/${entry}.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
  document.body.appendChild(script);
})();
