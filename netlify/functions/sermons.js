/**
 * Netlify Function: GET /api/sermons (mapped via netlify.toml)
 *
 * Proxies the YouTube Data API so the API key stays server-side.
 *
 * Environment variables (set in Netlify dashboard → Site settings → Environment variables):
 *   YOUTUBE_API_KEY      — YouTube Data API v3 key
 *   YOUTUBE_PLAYLIST_ID  — Playlist ID (use UU... for channel uploads)
 *
 * Query params:
 *   maxResults (optional, default 4, max 10)
 *
 * Response shape: { items: [...] }  (subset of YouTube playlistItems.list)
 */
exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const maxResults = Math.min(parseInt(params.maxResults || '4', 10), 10);

  const apiKey = process.env.YOUTUBE_API_KEY;
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID;

  if (!apiKey || !playlistId) {
    return json({ error: 'Server not configured' }, 500);
  }

  const ytUrl =
    'https://www.googleapis.com/youtube/v3/playlistItems' +
    `?part=snippet&maxResults=${maxResults}` +
    `&playlistId=${encodeURIComponent(playlistId)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  try {
    const ytRes = await fetch(ytUrl);
    if (!ytRes.ok) {
      const detail = await ytRes.text().catch(() => '');
      console.error('YouTube API error', ytRes.status, detail);
      return json({ error: 'YouTube API ' + ytRes.status, detail }, 502);
    }
    const data = await ytRes.json();
    const items = (data.items || []).map(item => ({
      snippet: {
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
        videoOwnerChannelTitle: item.snippet.videoOwnerChannelTitle,
        resourceId: item.snippet.resourceId,
      },
    }));
    return json({ items }, 200, {
      // Cache at Netlify edge for 10 min so we don't burn quota on every page load
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    });
  } catch (err) {
    return json({ error: 'Upstream fetch failed' }, 502);
  }
};

function json(body, statusCode = 200, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}
