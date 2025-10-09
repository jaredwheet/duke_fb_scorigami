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

let venuesCache = null;
export async function getVenues() {
  if (venuesCache) return venuesCache;
  const res = await fetch('https://api.collegefootballdata.com/venues', {
    headers: { Authorization: `Bearer ${process.env.CFB_DATA_KEY || ''}` },
  });
  venuesCache = await res.json();
  return venuesCache;
}

export async function getGameVenue(game) {
  if (!game?.venue_id) return null;
  const venues = await getVenues();
  const venue = venues.find(v => v.id === game.venue_id);
  return venue || null;
}
