begin;

alter table public.game_participants
  drop constraint if exists game_participants_participant_role_check;

alter table public.game_participants
  add constraint game_participants_participant_role_check
  check (participant_role in ('home', 'away', 'team_a', 'team_b'));

do $$
declare
  legacy record;
  v_sport_id bigint;
  v_team_a_id bigint;
  v_team_b_id bigint;
  v_game_id bigint;
  v_team_a_name text;
  v_team_b_name text;
  v_team_a_slug text;
  v_team_b_slug text;
begin
  select s.id into v_sport_id from public.sports s where s.slug = 'football';
  if v_sport_id is null then
    raise exception 'football sport seed is missing';
  end if;

  for legacy in
    select * from public.duke_football_games where season is not null
  loop
    v_team_a_name := coalesce(legacy."teamA"->>'name', 'Unknown team');
    v_team_b_name := coalesce(legacy."teamB"->>'name', 'Unknown team');
    v_team_a_slug := coalesce(legacy."teamA"->>'slug', 'legacy-team-a-' || legacy.id::text);
    v_team_b_slug := coalesce(legacy."teamB"->>'slug', 'legacy-team-b-' || legacy.id::text);

    insert into public.teams (sport_id, slug, name, short_name, metadata)
    values (
      v_sport_id,
      v_team_a_slug,
      v_team_a_name,
      legacy."teamA"->>'abbreviation',
      coalesce(legacy."teamA"::jsonb, '{}'::jsonb)
    )
    on conflict (sport_id, slug) do update
      set name = excluded.name,
          short_name = coalesce(excluded.short_name, public.teams.short_name),
          metadata = public.teams.metadata || excluded.metadata
    returning id into v_team_a_id;

    insert into public.teams (sport_id, slug, name, short_name, metadata)
    values (
      v_sport_id,
      v_team_b_slug,
      v_team_b_name,
      legacy."teamB"->>'abbreviation',
      coalesce(legacy."teamB"::jsonb, '{}'::jsonb)
    )
    on conflict (sport_id, slug) do update
      set name = excluded.name,
          short_name = coalesce(excluded.short_name, public.teams.short_name),
          metadata = public.teams.metadata || excluded.metadata
    returning id into v_team_b_id;

    v_game_id := null;
    if legacy.date is not null and legacy."teamAScore" is not null and legacy."teamBScore" is not null then
      select g.id into v_game_id
      from public.games g
      where g.sport_id = v_sport_id
        and g.season = legacy.season
        and g.start_at::date = legacy.date::date
        and (
          select array_agg(gp.score order by gp.score)
          from public.game_participants gp
          where gp.game_id = g.id
        ) = array[
          least(legacy."teamAScore", legacy."teamBScore"),
          greatest(legacy."teamAScore", legacy."teamBScore")
        ]::smallint[]
      limit 1;
    end if;

    if v_game_id is null then
      insert into public.games (
        sport_id,
        canonical_key,
        legacy_duke_game_id,
        season,
        week,
        start_at,
        status,
        city,
        state,
        neutral_site,
        notes,
        metadata
      )
      values (
        v_sport_id,
        'football:legacy:' || legacy.id::text,
        legacy.id,
        legacy.season,
        legacy.week,
        case when legacy.date is null then null else legacy.date at time zone 'UTC' end,
        case when legacy."teamAScore" is not null and legacy."teamBScore" is not null then 'final' else 'scheduled' end,
        legacy.city,
        legacy.state,
        legacy."neutralSite",
        legacy.notes,
        jsonb_build_object('source', 'duke_football_games', 'legacy_id', legacy.id)
      )
      returning id into v_game_id;

      insert into public.game_participants (game_id, team_id, participant_role, score, metadata)
      values
        (v_game_id, v_team_a_id, 'team_a', legacy."teamAScore", jsonb_build_object('legacy_slot', 'teamA')),
        (v_game_id, v_team_b_id, 'team_b', legacy."teamBScore", jsonb_build_object('legacy_slot', 'teamB'));
    else
      update public.games g
      set legacy_duke_game_id = coalesce(g.legacy_duke_game_id, legacy.id)
      where g.id = v_game_id;
    end if;

    insert into public.game_source_records (
      game_id,
      provider,
      external_game_id,
      payload,
      source_updated_at,
      metadata
    )
    values (
      v_game_id,
      'legacy_duke_football_games',
      legacy.id::text,
      to_jsonb(legacy),
      legacy.date at time zone 'UTC',
      jsonb_build_object('legacy_table_id', legacy.id)
    )
    on conflict (provider, external_game_id) do update
      set game_id = excluded.game_id,
          payload = excluded.payload,
          source_updated_at = excluded.source_updated_at,
          metadata = excluded.metadata,
          fetched_at = now();
  end loop;
end;
$$;

commit;
