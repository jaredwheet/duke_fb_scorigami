import fetch from 'node-fetch';

export async function fetchOptionalJson({
  provider,
  url,
  apiKey,
  headers = {},
} = {}) {
  if (!url || !apiKey) {
    return {
      provider,
      status: 'not_configured',
      data: null,
    };
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${provider} request failed with status ${response.status}`);
  }

  return {
    provider,
    status: 'ok',
    data: await response.json(),
  };
}
