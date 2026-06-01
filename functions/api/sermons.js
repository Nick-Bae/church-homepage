/**
 * Cloudflare Pages Function: GET /api/sermons
 *
 * Proxies the YouTube Data API so the API key stays server-side.
 *
 * Environment variables (set in Cloudflare Pages dashboard → Settings → Env vars):
 *   YOUTUBE_API_KEY      — YouTube Data API v3 key
 *   YOUTUBE_PLAYLIST_ID  — Playlist ID (use UU... for channel uploads)
 *
 * Query params:
 *   maxResults (optional, default 4, max 10)
 *
 * Response shape: { items: [...] }  (same shape as YouTube playlistItems.list)
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const maxResults = Math.min(parseInt(url.searchParams.get('maxResults') || '4', 10), 10);

  const apiKey = env.YOUTUBE_API_KEY;
  const playlistId = env.YOUTUBE_PLAYLIST_ID;

  if (!apiKey || !playlistId) {
    return json({ error: 'Server not configured' }, 500);
  }

  const ytUrl = `https://www.googleapis.com/youtube/v3/playlistItems` +
    `?part=snippet&maxResults=${maxResults}` +
    `&playlistId=${encodeURIComponent(playlistId)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  try {
    const ytRes = await fetch(ytUrl);
    if (!ytRes.ok) {
      return json({ error: 'YouTube API ' + ytRes.status }, 502);
    }
    const data = await ytRes.json();
    // Pass through only what the client needs
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
      // Cache at edge for 10 min so we don't burn quota on every page load
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    });
  } catch (err) {
    return json({ error: 'Upstream fetch failed' }, 502);
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
