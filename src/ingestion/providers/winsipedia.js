import fetch from 'node-fetch';
import { load } from 'cheerio';

export function parseWinsipediaSchedule(html) {
  const $ = load(html);
  return $('tr').toArray()
    .map((row) => {
      const link = $(row).find('a[href^="/games/"]').first();
      if (!link.length) return null;

      const cells = $(row).find('td').toArray().map((cell) => $(cell).text().replace(/\s+/g, ' ').trim());
      return {
        url: new URL(link.attr('href'), 'https://www.winsipedia.com').toString(),
        text: $(row).text().replace(/\s+/g, ' ').trim(),
        date: cells[0] || null,
        opponent: cells[1] || null,
        score: link.text().replace(/\s+/g, ' ').trim() || null,
      };
    })
    .filter(Boolean);
}

export async function fetchWinsipediaDukeSeason(season) {
  const response = await fetch(`https://www.winsipedia.com/duke/schedule/${season}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Winsipedia request failed with status ${response.status}`);
  }
  return parseWinsipediaSchedule(await response.text());
}
