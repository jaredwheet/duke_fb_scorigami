import fetch from 'node-fetch';
import { withTimeout } from '../agentClient.js';

const USER_AGENT = 'duke-football-newsletter/1.0';

function trimText(value, max = 1800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const response = await withTimeout(fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } }), timeoutMs);
  if (!response.ok) throw new Error(`Source request failed with status ${response.status}`);
  return response.json();
}

async function fetchText(url, fetchImpl, timeoutMs) {
  const response = await withTimeout(fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } }), timeoutMs);
  if (!response.ok) throw new Error(`Source request failed with status ${response.status}`);
  return trimText(await response.text(), 4000);
}

async function discoverRedditSources({ opponent, fetchImpl, timeoutMs }) {
  const query = encodeURIComponent(`Duke ${opponent}`);
  const subreddits = ['CFB', 'dukefootball'];
  const sources = [];
  const warnings = [];
  for (const subreddit of subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&restrict_sr=on&sort=new&limit=8&raw_json=1`;
    try {
      const payload = await fetchJson(url, fetchImpl, timeoutMs);
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
    } catch (error) {
      // Public community endpoints are optional discovery sources.
      warnings.push(error?.code === 'PROVIDER_TIMEOUT' ? 'provider_timeout' : 'provider_error');
    }
  }
  return { sources: sources.slice(0, 12), warnings };
}

export async function discoverMomentSources({
  issueData,
  sourcePayload = null,
  fetchImpl = fetch,
  configuredUrls = process.env.MOMENT_SOURCE_URLS || '',
  timeoutMs,
} = {}) {
  const opponent = issueData?.current_opponent || 'Duke football';
  const sources = [];
  const warnings = [];
  const configured = configuredUrls.split(',').map((url) => url.trim()).filter(Boolean);
  for (const url of configured.slice(0, 5)) {
    try {
      sources.push({ type: 'configured_source', url, excerpt: await fetchText(url, fetchImpl, timeoutMs) });
    } catch (error) {
      // A failed optional source must not block newsletter delivery.
      warnings.push(error?.code === 'PROVIDER_TIMEOUT' ? 'provider_timeout' : 'provider_error');
    }
  }

  const payloadText = trimText([sourcePayload?.notes, sourcePayload?.highlights].filter(Boolean).join(' '));
  if (payloadText) sources.push({ type: 'game_source', url: null, excerpt: payloadText });
  const reddit = await discoverRedditSources({ opponent, fetchImpl, timeoutMs });
  sources.push(...reddit.sources);
  warnings.push(...reddit.warnings);
  Object.defineProperty(sources, 'warnings', { value: warnings, enumerable: false });
  return sources;
}
