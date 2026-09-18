import 'dotenv/config';
import { ingestDukeSeason, persistMasterGame } from './ingestionEngine.js';

const year = Number(process.env.INGEST_YEAR || new Date().getFullYear());

export async function runIngestion({
  season = year,
  ingester = ingestDukeSeason,
  persister = persistMasterGame,
} = {}) {
  const masterGames = await ingester({ year: season });
  for (const masterGame of masterGames) {
    await persister(masterGame);
  }
  console.log(`Persisted ${masterGames.length} canonical Duke game(s) for ${season}.`);
  return masterGames;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runIngestion().catch((error) => {
    const context = error?.persistenceStage && error?.canonicalKey
      ? ` at ${error.persistenceStage} for ${error.canonicalKey}`
      : '';
    console.error(`Canonical ingestion failed${context}:`, error);
    process.exitCode = 1;
  });
}
