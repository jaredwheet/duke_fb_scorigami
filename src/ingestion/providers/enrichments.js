import fetch from 'node-fetch';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Provider request failed with status ${response.status}`);
  return response.json();
}

export async function fetchSportsDataverseAnalytics(masterGame, {
  endpoint = process.env.SPORTS_DATAVERSE_ENDPOINT,
  apiKey = process.env.SPORTS_DATAVERSE_API_KEY,
} = {}) {
  if (!endpoint || !apiKey) return { provider: 'sportsdataverse', status: 'not_configured', data: null };
  return {
    provider: 'sportsdataverse',
    status: 'ok',
    data: await fetchJson(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Game-External-Id': masterGame.sourceRecords[0]?.externalGameId || '',
      },
    }),
  };
}

export async function fetchVisualCrossingWeather(masterGame, {
  apiKey = process.env.VISUAL_CROSSING_API_KEY,
} = {}) {
  const location = [masterGame.city, masterGame.state].filter(Boolean).join(', ');
  if (!apiKey || !location || !masterGame.startAt) {
    return { provider: 'visual_crossing', status: 'not_configured', data: null };
  }

  const date = new Date(masterGame.startAt).toISOString().slice(0, 10);
  const url = new URL(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${date}`);
  url.searchParams.set('unitGroup', 'us');
  url.searchParams.set('include', 'hours,current');
  url.searchParams.set('contentType', 'json');
  url.searchParams.set('key', apiKey);

  return {
    provider: 'visual_crossing',
    status: 'ok',
    data: await fetchJson(url),
  };
}

export async function fetchOddsApiSnapshot(masterGame, {
  endpoint = process.env.ODDS_API_ENDPOINT || 'https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds/',
  apiKey = process.env.ODDS_API_KEY,
} = {}) {
  if (!apiKey) return { provider: 'odds_api', status: 'not_configured', data: null };

  const url = new URL(endpoint);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', apiKey);

  return {
    provider: 'odds_api',
    status: 'ok',
    data: await fetchJson(url),
  };
}
