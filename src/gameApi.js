import fetch from 'node-fetch';

export async function getDukeGame(todayDate) {
  const year = new Date().getFullYear();
  const url = `https://api.collegefootballdata.com/games?year=${year}&team=Duke`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });
  const games = await res.json();
  const game = games.find((g) => g.startDate.startsWith(todayDate));
  return game || null;
}

export async function getGameVenue(game) {
  if (!game?.venueId) return null;
  const venues = await getVenues();
  const venue = venues.find(v => v.id === game.venueId);
  return venue || null;
}

let venuesCache = null;
export async function getVenues() {
  if (venuesCache) return venuesCache;
  const res = await fetch('https://api.collegefootballdata.com/venues', {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });
  venuesCache = await res.json();
  return venuesCache;
}

// Helper to get the next scheduled Duke game (not completed, after today)
export async function getNextScheduledDukeGame() {
  const year = new Date().getFullYear();
  const url = `https://api.collegefootballdata.com/games?year=${year}&team=Duke`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });
  const games = await res.json();
  const now = new Date();
  // Find the next game that is not completed and is after today
  return games
    .filter(g => !g.completed && new Date(g.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null;
}

// Fetch the last completed Duke football game
export async function getLastCompletedDukeGame() {
  const year = new Date().getFullYear();
  const url = `https://api.collegefootballdata.com/games?year=${year}&team=Duke`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });
  const games = await res.json();
  // Filter for completed games and sort by startDate descending
  const completedGames = games.filter(g => g.completed).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return completedGames[0] || null;
}
