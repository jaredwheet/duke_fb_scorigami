begin;

-- Existing rows represent completed publications. Give them an explicit terminal state before
-- introducing pre-post claims, and replace nullable identity keys with deterministic legacy keys.
update public.tweeted_scores
set score_key = coalesce(score_key, 'legacy:' || id::text)
where score_key is null;

alter table public.tweeted_scores
  alter column score_key set not null,
  add column if not exists status text not null default 'posted',
  add column if not exists claim_token text,
  add column if not exists claimed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tweeted_scores'::regclass
      and conname = 'tweeted_scores_claim_token_check'
  ) then
    alter table public.tweeted_scores
      add constraint tweeted_scores_claim_token_check
      check (status <> 'claimed' or (claim_token is not null and btrim(claim_token) <> ''));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tweeted_scores'::regclass
      and conname = 'tweeted_scores_status_check'
  ) then
    alter table public.tweeted_scores
      add constraint tweeted_scores_status_check
      check (status in ('claimed', 'posted', 'uncertain'));
  end if;
end;
$$;

create unique index if not exists tweeted_scores_game_score_key
  on public.tweeted_scores (game_id, score_key);

create or replace function public.claim_tweeted_score(
  p_game_id bigint,
  p_score_key text,
  p_claim_token text
)
returns table (claimed boolean, claim_token text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then
    raise exception 'claim token is required';
  end if;

  insert into public.tweeted_scores (game_id, score_key, status, claim_token, claimed_at, attempts)
  values (p_game_id, p_score_key, 'claimed', p_claim_token, now(), 1)
  on conflict (game_id, score_key) do nothing;

  if found then
    return query select true, p_claim_token, 'claimed'::text;
    return;
  end if;

  return query
    select false, null::text, ts.status
    from public.tweeted_scores ts
    where ts.game_id = p_game_id and ts.score_key = p_score_key;
end;
$$;

revoke all on function public.claim_tweeted_score(bigint, text, text) from public, anon, authenticated;
grant execute on function public.claim_tweeted_score(bigint, text, text) to service_role;

create or replace function public.finalize_tweeted_score(
  p_game_id bigint,
  p_score_key text,
  p_claim_token text,
  p_tweet_id text,
  p_tweet_url text,
  p_content_type text,
  p_template_version text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then
    raise exception 'claim token is required';
  end if;
  update public.tweeted_scores
  set status = 'posted',
      tweet_id = p_tweet_id,
      tweet_url = p_tweet_url,
      content_type = p_content_type,
      template_version = p_template_version,
      tweeted_at = now(),
      last_error = null
  where game_id = p_game_id
    and score_key = p_score_key
    and claim_token = p_claim_token
    and status = 'claimed';
  return found;
end;
$$;

revoke all on function public.finalize_tweeted_score(bigint, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_tweeted_score(bigint, text, text, text, text, text, text) to service_role;

create or replace function public.record_tweeted_score_error(
  p_game_id bigint,
  p_score_key text,
  p_claim_token text,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then
    raise exception 'claim token is required';
  end if;
  update public.tweeted_scores
  set status = 'uncertain',
      attempts = coalesce(attempts, 0) + 1,
      last_error = p_error
  where game_id = p_game_id
    and score_key = p_score_key
    and claim_token = p_claim_token
    and status = 'claimed';
  return found;
end;
$$;

revoke all on function public.record_tweeted_score_error(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.record_tweeted_score_error(bigint, text, text, text) to service_role;

commit;
