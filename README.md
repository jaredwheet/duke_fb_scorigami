# Duke FB Scorigami

A tool for exploring unique and rare final scores in Duke University football history.

## Features

- Calculates and visualizes all unique final scores ("scorigami") in Duke football games.
- Highlights never-before-seen scores.
- Provides historical data and statistics.
- Interactive interface for exploring results.

## Installation

```bash
npm install
```

## Configuration

This project requires several API keys and secrets to function properly. You'll need to configure these as environment variables.

### Required Environment Variables

The following environment variables are required:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous/public API key
- `TWITTER_API_KEY` - Twitter API key (from Twitter Developer Portal)
- `TWITTER_API_SECRET` - Twitter API secret
- `TWITTER_ACCESS_TOKEN` - Twitter access token
- `TWITTER_ACCESS_SECRET` - Twitter access token secret
- `CFB_DATA_KEY` - College Football Data API key (from https://collegefootballdata.com)

### Local Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual API keys and secrets

### GitHub Actions / Production Setup

To add these secrets to your GitHub repository for use in GitHub Actions:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of the following secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `TWITTER_API_KEY`
   - `TWITTER_API_SECRET`
   - `TWITTER_ACCESS_TOKEN`
   - `TWITTER_ACCESS_SECRET`
   - `CFB_DATA_KEY`

For each secret, enter the name exactly as shown above and paste the corresponding value.

### Where to Get API Keys

- **Supabase**: Create a project at https://supabase.com - find your URL and anon key in Project Settings → API
- **Twitter API**: Apply for API access at https://developer.twitter.com - create an app to get keys and tokens
- **College Football Data**: Register at https://collegefootballdata.com to get an API key

## Usage

```bash
node index.js
```

## Project Structure

- `index.js` — Entry point for the application.
- `scorigami.js` — Main logic for score calculations.
- `data/` — Directory containing historical game data.
- `utils.js` — Helper functions.

## Contributing

Pull requests are welcome. Please open an issue first to discuss changes.

## License

MIT License.