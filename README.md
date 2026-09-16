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

Canonical ingestion can be run separately after setting `INGEST_YEAR`:

```bash
INGEST_YEAR=2026 INGEST_DETAILS=true npm run ingest
```

GitHub Actions also provides a manual **Canonical Data Ingestion** workflow. Run it with the target season before enabling an automatic ingestion schedule.

That workflow also recalculates canonical Scorigami facts and persists tiered editorial directives in `game_facts` and `editorial_directives`.

For email testing, add `RESEND_API_KEY` and `NEWSLETTER_TEST_TO` as GitHub Actions secrets, then run the manual **Newsletter Test** workflow. It uses Resend's `onboarding@resend.dev` test sender and does not send to the subscriber table.

## Media Guide Reference Data

The reviewed 2026 media guide is stored as a versioned reference artifact at `data/media-guides/2026.json`. It supplies roster context, the 2025 review, opponent series, program records, comeback history, and historical editorial facts. Canonical Supabase games and CFBData remain authoritative for live schedules, scores, play-by-play, and current statistics.

Extract and validate the PDF locally with:

```bash
npm run extract:guide
npm run curate:guide
```

The extraction command writes ignored page-level text to `data/generated/`; the application does not parse the PDF during newsletter rendering. `npm run guide:preview` prints the structured 2026 season-preview contract. The optional Supabase migration `supabase/migrations/20260916150000_add_media_guide_claims.sql` and `npm run import:guide` provide a durable, citation-backed claims store after the migration is applied.

## GitHub Actions

The scheduled workflow requires these repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CFB_DATA_KEY`, `OPENAI_API_KEY`, `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, and `TWITTER_ACCESS_SECRET`. The Supabase service-role and OpenAI keys are server-only and must never be exposed in a public site or client application.

The workflow runs every 15 minutes. A manual run accepts `backfill_days`, which defaults to 30. Account mentions are disabled; the configured hashtags remain.

Final Scorigami posts generate a Wallace Wade scoreboard card. When `OPENAI_API_KEY` is available, OpenAI edits the stadium screen while the application overlays the verified score and team data. If image editing fails, the bot falls back to a deterministic card and then to text-only posting.

Before deploying the post-metadata release, run `supabase/migrations/20260914_add_post_metadata.sql` in the production Supabase SQL Editor. It adds tweet IDs, URLs, content types, external game IDs, unique event indexes, and enables RLS on the bot tables. Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub Actions before running the updated workflow.

## Project Structure

- `src/index.js` — Entry point and tweet workflow.
- `src/scorigami.js` — Database-backed score calculations.
- `src/gameApi.js` — CollegeFootballData schedule and venue requests.
- `src/gameUtils.js` — Score and recovery-window helpers.
- `data/` — Directory containing historical game data.

## Sports Publishing Engine

The canonical publishing schema lives in `supabase/migrations/20260916133805_sports_publishing_foundation.sql`. It adds normalized sports, teams, games, source records, analytics, deterministic facts, editorial directives, subscribers, newsletter issues, and delivery history without removing the legacy Duke tables.

The first ingestion slice is available with `npm run ingest`. It normalizes the current-season CFBData schedule and can persist canonical games through the server-only Supabase service-role key. Optional provider adapters are available for Winsipedia, SportsDataverse, Visual Crossing, and The Odds API as their credentials/endpoints are configured.

Event detection is deterministic and returns tiered `headline_directive` data. AI is intended only to turn those verified facts into editorial language; it must not calculate statistics.

## Contributing

Pull requests are welcome. Please open an issue first to discuss changes.

## License

MIT License.
