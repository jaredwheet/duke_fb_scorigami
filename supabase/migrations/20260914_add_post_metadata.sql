begin;

alter table public.duke_football_games
  add column if not exists external_game_id bigint;

alter table public.tweeted_scores
  add column if not exists tweet_id text,
  add column if not exists tweet_url text,
  add column if not exists content_type text,
  add column if not exists template_version text,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;

alter table public.duke_football_games enable row level security;
alter table public.tweeted_scores enable row level security;

create unique index if not exists duke_football_games_external_game_id_key
  on public.duke_football_games (external_game_id)
  where external_game_id is not null;

create unique index if not exists tweeted_scores_game_score_key
  on public.tweeted_scores (game_id, score_key);

create unique index if not exists tweeted_scores_tweet_id_key
  on public.tweeted_scores (tweet_id)
  where tweet_id is not null;

commit;
