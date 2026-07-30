(async () => {
  const fallback = window.MVL_DATA;
  const config = window.MVL_SUPABASE;
  const entry = document.currentScript.dataset.entry;
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
      games: managed.games?.length ? managed.games : fallback.games,
    };
  } catch (error) {
    console.warn('Using bundled MVL data:', error);
  }
  const script = document.createElement('script');
  script.src = `js/${entry}.js`;
  document.body.appendChild(script);
})();
