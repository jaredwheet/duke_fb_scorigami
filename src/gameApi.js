import fetch from 'node-fetch';

function dateKey(value, timeZone = 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchCollegeFootballData(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });

  if (!res.ok) {
    throw new Error(`College Football Data request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('College Football Data returned an unexpected response');
  }

  return data;
}

export async function getDukeGames(year = new Date().getFullYear()) {
  const url = `https://api.collegefootballdata.com/games?year=${year}&team=Duke`;
  return fetchCollegeFootballData(url);
}

export async function getDukeGame(todayDate, games = null) {
  const scheduledGames = games || await getDukeGames();
  return scheduledGames.find((game) => dateKey(game.startDate) === todayDate) || null;
}

export async function getGameVenue(game) {
  if (game?.venueId == null) return null;
  const venues = await getVenues();
  const venue = venues.find((venue) => String(venue.id) === String(game.venueId));
  return venue || null;
}

let venuesCache = null;
export async function getVenues() {
  if (venuesCache) return venuesCache;
  venuesCache = await fetchCollegeFootballData('https://api.collegefootballdata.com/venues');
  return venuesCache;
}

// Helper to get the next scheduled Duke game (not completed, after today)
export async function getNextScheduledDukeGame(games = null, now = new Date()) {
  const scheduledGames = games || await getDukeGames();
  // Find the next game that is not completed and is after today
  return scheduledGames
    .filter((game) => !game.completed && new Date(game.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null;
}

// Fetch the last completed Duke football game
export async function getLastCompletedDukeGame(games = null) {
  const scheduledGames = games || await getDukeGames();
  // Filter for completed games and sort by startDate descending
  const completedGames = scheduledGames
    .filter((game) => game.completed)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return completedGames[0] || null;
}
