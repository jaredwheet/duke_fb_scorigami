import 'dotenv/config';
import { refreshDukeFacts } from './refreshFacts.js';

try {
  const count = await refreshDukeFacts();
  console.log(`Persisted deterministic facts for ${count} completed canonical game(s).`);
} catch (error) {
  console.error('Fact detection failed:', error);
  process.exitCode = 1;
}
