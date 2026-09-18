begin;

alter table public.newsletter_deliveries
  drop constraint if exists newsletter_deliveries_status_check;

alter table public.newsletter_deliveries
  add column if not exists claim_token text,
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

alter table public.newsletter_deliveries
  add constraint newsletter_deliveries_status_check
  check (status in ('queued', 'claimed', 'sent', 'delivered', 'bounced', 'failed', 'uncertain'));

create or replace function public.claim_newsletter_delivery(
  p_issue_id bigint,
  p_subscriber_id bigint,
  p_claim_token text
)
returns table (claimed boolean, delivery_id bigint, status text, claim_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.newsletter_deliveries%rowtype;
  v_status text;
  v_claim_token text;
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then
    raise exception 'newsletter claim token is required';
  end if;

  insert into public.newsletter_deliveries (issue_id, subscriber_id, status, claim_token, claimed_at, last_attempt_at, attempts)
  values (p_issue_id, p_subscriber_id, 'claimed', p_claim_token, now(), now(), 1)
  on conflict (issue_id, subscriber_id) do nothing
  returning id, public.newsletter_deliveries.status, public.newsletter_deliveries.claim_token into delivery_id, v_status, v_claim_token;

  if found then
    return query select true, delivery_id, v_status, v_claim_token;
    return;
  end if;

  select * into existing from public.newsletter_deliveries
  where issue_id = p_issue_id and subscriber_id = p_subscriber_id;

  if existing.status in ('queued', 'failed') then
    update public.newsletter_deliveries as delivery
    set status = 'claimed', claim_token = p_claim_token, claimed_at = now(),
        last_attempt_at = now(), attempts = coalesce(existing.attempts, 0) + 1
    where delivery.id = existing.id and delivery.status in ('queued', 'failed')
    returning delivery.id, delivery.status, delivery.claim_token into delivery_id, v_status, v_claim_token;
    if found then
      return query select true, delivery_id, v_status, v_claim_token;
      return;
    end if;
  end if;

  return query select false, existing.id, existing.status, existing.claim_token;
end;
$$;

create or replace function public.complete_newsletter_delivery(
  p_delivery_id bigint,
  p_claim_token text,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then raise exception 'newsletter claim token is required'; end if;
  update public.newsletter_deliveries
  set status = 'sent', provider_message_id = p_provider_message_id, sent_at = now(), error = null, last_error = null
  where id = p_delivery_id and claim_token = p_claim_token and status = 'claimed';
  return found;
end;
$$;

create or replace function public.fail_newsletter_delivery(
  p_delivery_id bigint,
  p_claim_token text,
  p_error text,
  p_uncertain boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or btrim(p_claim_token) = '' then raise exception 'newsletter claim token is required'; end if;
  update public.newsletter_deliveries
  set status = case when p_uncertain then 'uncertain' else 'failed' end,
      error = left(p_error, 2000), last_error = left(p_error, 2000)
  where id = p_delivery_id and claim_token = p_claim_token and status = 'claimed';
  return found;
end;
$$;

revoke all on function public.claim_newsletter_delivery(bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.claim_newsletter_delivery(bigint, bigint, text) to service_role;
revoke all on function public.complete_newsletter_delivery(bigint, text, text) from public, anon, authenticated;
grant execute on function public.complete_newsletter_delivery(bigint, text, text) to service_role;
revoke all on function public.fail_newsletter_delivery(bigint, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fail_newsletter_delivery(bigint, text, text, boolean) to service_role;

commit;
