import fetch from 'node-fetch';

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.text();
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    throw new Error(`CFBData request failed with status ${response.status}${detail}`);
  }
  return response.json();
}

export async function fetchCfbDataGames({
  year = new Date().getFullYear(),
  team = 'Duke',
  apiKey = process.env.CFB_DATA_KEY,
} = {}) {
  if (!apiKey) throw new Error('CFB_DATA_KEY is required for ingestion');

  const url = new URL('https://api.collegefootballdata.com/games');
  url.searchParams.set('year', String(year));
  url.searchParams.set('team', team);
  const games = await fetchJson(url, apiKey);
  if (!Array.isArray(games)) throw new Error('CFBData games response was not an array');
  return games;
}

async function fetchOptionalEndpoint(url, apiKey) {
  try {
    return { data: await fetchJson(url, apiKey), error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export function buildGameDetailsParams(masterGame) {
  const externalGameId = masterGame.sourceRecords[0]?.externalGameId;
  if (!externalGameId) throw new Error('CFBData game details require an external game id');

  const params = new URLSearchParams({
    year: String(masterGame.season),
    id: String(externalGameId),
    team: 'Duke',
  });
  if (masterGame.week != null) params.set('week', String(masterGame.week));
  return params;
}

export async function fetchCfbDataGameDetails(masterGame, {
  apiKey = process.env.CFB_DATA_KEY,
} = {}) {
  if (!apiKey) return { provider: 'cfbdata', status: 'not_configured', metricSet: 'game_details', data: null };

  const baseParams = buildGameDetailsParams(masterGame);
  const requests = {
    teamStats: fetchOptionalEndpoint(`https://api.collegefootballdata.com/games/teams?${baseParams}`, apiKey),
    playerStats: fetchOptionalEndpoint(`https://api.collegefootballdata.com/games/players?${baseParams}`, apiKey),
  };

  if (masterGame.week != null) {
    const playsParams = new URLSearchParams({
      year: String(masterGame.season),
      week: String(masterGame.week),
      team: 'Duke',
    });
    requests.plays = fetchOptionalEndpoint(`https://api.collegefootballdata.com/plays?${playsParams}`, apiKey);
  }

  const entries = await Promise.all(Object.entries(requests).map(async ([key, promise]) => [key, await promise]));
  const data = {};
  const errors = {};
  for (const [key, result] of entries) {
    data[key] = result.data;
    if (result.error) errors[key] = result.error;
  }

  return {
    provider: 'cfbdata',
    status: Object.keys(errors).length > 0 ? 'partial' : 'ok',
    metricSet: 'game_details',
    data,
    errors,
  };
}
