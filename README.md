# Duke FB Scorigami

A tool for exploring unique and rare final scores in Duke University football history.

## Features

- Calculates and visualizes all unique final scores ("scorigami") in Duke football games.
- Highlights never-before-seen scores.
- Provides historical data and statistics.
- Interactive interface for exploring results.

## Installation

npm install
```

## Usage

```bash
npm ci
node src/index.js
```

The bot reads Duke's current-season schedule from CollegeFootballData, checks each final score against `duke_football_games`, and records tweet state in `tweeted_scores`. Scheduled runs also recover completed games from the previous 30 days. To recover a different window locally, set `BACKFILL_DAYS`:

```bash
BACKFILL_DAYS=14 node src/index.js
```

## GitHub Actions

The scheduled workflow requires these repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CFB_DATA_KEY`, `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, and `TWITTER_ACCESS_SECRET`. The service-role key is server-only and must never be exposed in a public site or client application.

The workflow runs every 15 minutes. A manual run accepts `backfill_days`, which defaults to 30. Account mentions are disabled; the configured hashtags remain.

Before deploying the post-metadata release, run `supabase/migrations/20260914_add_post_metadata.sql` in the production Supabase SQL Editor. It adds tweet IDs, URLs, content types, external game IDs, unique event indexes, and enables RLS on the bot tables. Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub Actions before running the updated workflow.

## Project Structure

- `src/index.js` — Entry point and tweet workflow.
- `src/scorigami.js` — Database-backed score calculations.
- `src/gameApi.js` — CollegeFootballData schedule and venue requests.
- `src/gameUtils.js` — Score and recovery-window helpers.
- `data/` — Directory containing historical game data.

## Contributing

Pull requests are welcome. Please open an issue first to discuss changes.

## License

MIT License.
