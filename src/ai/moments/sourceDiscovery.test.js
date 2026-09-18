import { discoverMomentSources } from './sourceDiscovery.js';

test('Q7 EDGE discovery sources are bounded and excerpts are truncated', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('reddit.com')) return {
      ok: true,
      json: async () => ({ data: { children: Array.from({ length: 20 }, (_, index) => ({ data: {
        title: `Candidate ${index}`,
        permalink: `/r/CFB/comments/${index}`,
        selftext: 'evidence',
      } })) } }),
    };
    return { ok: true, text: async () => 'x'.repeat(5000) };
  };
  const sources = await discoverMomentSources({
    issueData: { current_opponent: 'Illinois' },
    configuredUrls: ['a', 'b', 'c', 'd', 'e', 'f'].join(','),
    fetchImpl,
    timeoutMs: 25,
  });

  expect(calls.filter((url) => !url.includes('reddit.com'))).toHaveLength(5);
  expect(calls.filter((url) => url.includes('reddit.com'))).toHaveLength(2);
  expect(sources).toHaveLength(17);
  expect(sources.filter((source) => source.type === 'reddit')).toHaveLength(12);
  expect(Math.max(...sources.map((source) => source.excerpt.length))).toBeLessThanOrEqual(4000);
});

test('Q7 EDGE discovery failures expose safe warning codes', async () => {
  const sources = await discoverMomentSources({
    issueData: { current_opponent: 'Illinois' },
    configuredUrls: 'https://configured.example.invalid',
    fetchImpl: async () => { throw Object.assign(new Error('raw prompt secret'), { code: 'PROVIDER_TIMEOUT' }); },
    timeoutMs: 25,
  });

  expect(sources.warnings).toEqual(['provider_timeout', 'provider_timeout', 'provider_timeout']);
  expect(JSON.stringify(sources)).not.toContain('raw prompt secret');
});
