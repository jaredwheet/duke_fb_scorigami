import fetch from 'node-fetch';

const USER_AGENT = 'duke-football-newsletter/1.0';

function trimText(value, max = 1800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Source request failed with status ${response.status}`);
  return response.json();
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Source request failed with status ${response.status}`);
  return trimText(await response.text(), 4000);
}

async function discoverRedditSources({ opponent, fetchImpl }) {
  const query = encodeURIComponent(`Duke ${opponent}`);
  const subreddits = ['CFB', 'dukefootball'];
  const sources = [];
  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=on&sort=new&limit=8&raw_json=1`;
    try {
      const payload = await fetchJson(url, fetchImpl);
      for (const child of payload?.data?.children || []) {
        const post = child.data || {};
        const permalink = post.permalink ? `https://www.reddit.com${post.permalink}` : post.url;
        if (!permalink) continue;
        sources.push({
          type: 'reddit',
          title: trimText(post.title, 300),
          url: permalink,
          excerpt: trimText(post.selftext || post.title),
        });
      }
    } catch {
      // Public community endpoints are optional discovery sources.
    }
  }
  return sources.slice(0, 12);
}

export async function discoverMomentSources({
  issueData,
  sourcePayload = null,
  fetchImpl = fetch,
  configuredUrls = process.env.MOMENT_SOURCE_URLS || '',
} = {}) {
  const opponent = issueData?.current_opponent || 'Duke football';
  const sources = [];
  const configured = configuredUrls.split(',').map((url) => url.trim()).filter(Boolean);
  for (const url of configured.slice(0, 5)) {
    try {
      sources.push({ type: 'configured_source', url, excerpt: await fetchText(url, fetchImpl) });
    } catch {
      // A failed optional source must not block newsletter delivery.
    }
  }

  const payloadText = trimText([sourcePayload?.notes, sourcePayload?.highlights].filter(Boolean).join(' '));
  if (payloadText) sources.push({ type: 'game_source', url: null, excerpt: payloadText });
  sources.push(...await discoverRedditSources({ opponent, fetchImpl }));
  return sources;
}
