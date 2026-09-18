begin;

create or replace function public.import_media_guide_claims(p_edition_year integer, p_title text, p_source_file text, p_page_count integer, p_source_sha256 text, p_reviewed_at date, p_claims jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_edition_id bigint; v_existing_source_sha256 text; v_existing record; v_claim record; v_claim_count integer;
begin
  if p_edition_year <> 2026 or p_page_count <> 308 or p_source_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'unsupported or invalid media-guide edition contract'; end if;
  if jsonb_typeof(p_claims) <> 'array' or jsonb_array_length(p_claims) <> 33 then raise exception 'media-guide import requires exactly 33 claims'; end if;
  if (select count(*) from jsonb_array_elements(p_claims)) <> (select count(distinct value->>'claim_key') from jsonb_array_elements(p_claims)) then raise exception 'duplicate media-guide claim key'; end if;
  for v_claim in select * from jsonb_to_recordset(p_claims) as row(claim_key text, category text, payload jsonb, citation_id text, page_start integer, page_end integer, source_label text, source_sha256 text, claim_sha256 text, verification_status text) loop
    if v_claim.claim_key is null or btrim(v_claim.claim_key) = '' or v_claim.citation_id is null or btrim(v_claim.citation_id) = '' or v_claim.source_sha256 <> p_source_sha256 or v_claim.claim_sha256 !~ '^[0-9a-f]{64}$' or v_claim.verification_status <> 'verified' or v_claim.page_start < 1 or v_claim.page_end is null or v_claim.page_end < v_claim.page_start or v_claim.page_end > p_page_count then raise exception 'invalid media-guide claim contract for %', v_claim.claim_key; end if;
  end loop;
  select id, source_sha256 into v_edition_id, v_existing_source_sha256 from public.media_guide_editions where edition_year = p_edition_year for update;
  if v_edition_id is not null and v_existing_source_sha256 is not null and v_existing_source_sha256 <> p_source_sha256 then raise exception 'media-guide source hash drift for edition %', p_edition_year; end if;
  insert into public.media_guide_editions (edition_year, title, source_file, page_count, source_sha256, reviewed_at) values (p_edition_year, p_title, p_source_file, p_page_count, p_source_sha256, p_reviewed_at) on conflict (edition_year) do update set title = excluded.title, source_file = excluded.source_file, page_count = excluded.page_count, source_sha256 = excluded.source_sha256, reviewed_at = excluded.reviewed_at returning id into v_edition_id;
  if exists (select 1 from public.media_guide_claims existing where existing.edition_id = v_edition_id and not exists (select 1 from jsonb_array_elements(p_claims) incoming where incoming->>'claim_key' = existing.claim_key)) then raise exception 'media-guide claim set drift for edition %', p_edition_year; end if;
  for v_claim in select * from jsonb_to_recordset(p_claims) as row(claim_key text, category text, payload jsonb, citation_id text, page_start integer, page_end integer, source_label text, source_sha256 text, claim_sha256 text, verification_status text) loop
    select * into v_existing from public.media_guide_claims where edition_id = v_edition_id and claim_key = v_claim.claim_key;
    if found then
      if v_existing.claim_sha256 <> v_claim.claim_sha256 or v_existing.source_sha256 <> v_claim.source_sha256 or v_existing.payload <> v_claim.payload or v_existing.category <> v_claim.category or v_existing.citation_id <> v_claim.citation_id or v_existing.page_start <> v_claim.page_start or v_existing.page_end is distinct from v_claim.page_end or v_existing.source_label is distinct from v_claim.source_label or v_existing.verification_status <> v_claim.verification_status then raise exception 'media-guide claim drift for %', v_claim.claim_key; end if;
    else
      insert into public.media_guide_claims (edition_id, claim_key, category, payload, citation_id, page_start, page_end, source_label, source_sha256, claim_sha256, verification_status) values (v_edition_id, v_claim.claim_key, v_claim.category, v_claim.payload, v_claim.citation_id, v_claim.page_start, v_claim.page_end, v_claim.source_label, v_claim.source_sha256, v_claim.claim_sha256, v_claim.verification_status);
    end if;
  end loop;
  select count(*) into v_claim_count from public.media_guide_claims where edition_id = v_edition_id;
  return jsonb_build_object('edition_id', v_edition_id, 'claim_count', v_claim_count);
end;
$$;

commit;
