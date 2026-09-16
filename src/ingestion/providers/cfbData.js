import fetch from 'node-fetch';

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`CFBData request failed with status ${response.status}`);
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
