// src/parseWinsipedia.js
import { load } from "cheerio";

export function parseGames(html) {
  const $ = load(html);
  const games = [];

  console.log("Looking for table.games rows...");
  const rows = $("table.games tbody tr");
  console.log(`Found ${rows.length} rows in table.games`);

  rows.each((i, row) => {
    const tds = $(row).find("td");
    console.log(`Row ${i} has ${tds.length} cells`);

    if (tds.length < 4) {
      console.log(`Skipping row ${i} — not enough cells`);
      return;
    }

    const date = $(tds[0]).text().replace(/\s+/g, " ").trim();
    const opponent = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const resultText = $(tds[2]).text().replace(/\s+/g, " ").trim();
    let scoreText = $(tds[3]).text().replace(/\s+/g, " ").trim();

    console.log(`Row ${i}: date='${date}', opponent='${opponent}', result='${resultText}', score='${scoreText}'`);

    if (!scoreText.match(/\d+[-–]\d+/)) {
      console.log(`Skipping row ${i} — invalid score format`);
      return;
    }

    scoreText = scoreText.replace("–", "-");
    const [dukeScore, opponentScore] = scoreText
      .split("-")
      .map((s) => parseInt(s.trim()));

    console.log(`Parsed row ${i}: dukeScore=${dukeScore}, opponentScore=${opponentScore}`);

    games.push({ date, opponent, dukeScore, opponentScore, result: resultText });
  });

  console.log(`Total parsed games: ${games.length}`);
  return games;
}
// src/parseWinsipedia.js
import { load } from "cheerio";

export function parseGames(html) {
  const $ = load(html);
  const games = [];

  console.log("Looking for table.games rows...");
  const rows = $("table.games tbody tr");
  console.log(`Found ${rows.length} rows in table.games`);

  rows.each((i, row) => {
    const tds = $(row).find("td");
    console.log(`Row ${i} has ${tds.length} cells`);

    if (tds.length < 4) {
      console.log(`Skipping row ${i} — not enough cells`);
      return;
    }

    const date = $(tds[0]).text().replace(/\s+/g, " ").trim();
    const opponent = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const resultText = $(tds[2]).text().replace(/\s+/g, " ").trim();
    let scoreText = $(tds[3]).text().replace(/\s+/g, " ").trim();

    console.log(`Row ${i}: date='${date}', opponent='${opponent}', result='${resultText}', score='${scoreText}'`);

    if (!scoreText.match(/\d+[-–]\d+/)) {
      console.log(`Skipping row ${i} — invalid score format`);
      return;
    }

    scoreText = scoreText.replace("–", "-");
    const [dukeScore, opponentScore] = scoreText
      .split("-")
      .map((s) => parseInt(s.trim()));

    console.log(`Parsed row ${i}: dukeScore=${dukeScore}, opponentScore=${opponentScore}`);

    games.push({ date, opponent, dukeScore, opponentScore, result: resultText });
  });

  console.log(`Total parsed games: ${games.length}`);
  return games;
}
