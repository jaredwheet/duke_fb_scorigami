import 'dotenv/config';
import { ingestDukeSeason, persistMasterGame } from './ingestionEngine.js';

const year = Number(process.env.INGEST_YEAR || new Date().getFullYear());

try {
  const masterGames = await ingestDukeSeason({ year });
  for (const masterGame of masterGames) {
    await persistMasterGame(masterGame);
  }
  console.log(`Persisted ${masterGames.length} canonical Duke game(s) for ${year}.`);
} catch (error) {
  console.error('Canonical ingestion failed:', error);
  process.exitCode = 1;
}
