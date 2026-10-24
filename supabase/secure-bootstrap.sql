-- Template: apply only to the isolated SCHOOL Supabase project.
-- Replace placeholders from secure local provisioning; DO NOT commit real secrets.
-- Nothing here may be applied to GameHub Ultra.
create schema if not exists portal_private;
revoke all on schema portal_private from public, anon, authenticated;

create table if not exists portal_private.config (
  id smallint primary key check (id = 1),
  admin_email text not null check (admin_email = lower(admin_email)),
  invite_hash text not null check (invite_hash ~ '^[a-f0-9]{64}$'),
  cron_hash text not null check (cron_hash ~ '^[a-f0-9]{64}$')
);
alter table portal_private.config enable row level security;
revoke all on portal_private.config from public,anon,authenticated;
insert into portal_private.config(id,admin_email,invite_hash,cron_hash)
values (1,'__ADMIN_EMAIL__','__INVITE_SHA256__','__CRON_SHA256__')
on conflict (id) do update set admin_email=excluded.admin_email,
invite_hash=excluded.invite_hash, cron_hash=excluded.cron_hash;

-- No auth.user metadata or client-set role is trusted. The verified email must match
-- the single server-owned email. Users cannot insert/update portal_roles directly.
create or replace function public.portal_claim_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  uid := (select auth.uid());
  if uid is null then return false; end if;
  if not exists (
     select 1 from auth.users u
     join portal_private.config conf on conf.id=1
     where u.id=uid and lower(u.email)=conf.admin_email
       and u.email_confirmed_at is not null
       and coalesce(u.is_anonymous,false)=false
  ) then return false; end if;
  insert into public.portal_roles(user_id,role) values(uid,'admin')
  on conflict(user_id) do update set role='admin';
  return true;
end; $$;
revoke all on function public.portal_claim_admin() from public, anon, authenticated;
grant execute on function public.portal_claim_admin() to authenticated;

create or replace function public.portal_join_course(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  uid := (select auth.uid());
  if uid is null or p_code is null or char_length(p_code)<20 or char_length(p_code)>100 then return false; end if;
  if not exists (select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false) then return false; end if;
  if not exists (
    select 1 from portal_private.config conf
    where conf.id=1 and conf.invite_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex')
  ) then return false; end if;
  insert into public.portal_members(user_id) values(uid) on conflict(user_id) do nothing;
  return true;
end; $$;
revoke all on function public.portal_join_course(text) from public, anon, authenticated;
grant execute on function public.portal_join_course(text) to authenticated;

-- Only the strong server-owned CRON_SECRET grants access to push endpoints.
-- Per-subscription per-calendar-day uniqueness prevents repeated sends.
create or replace function public.portal_claim_daily_push_jobs(p_token text,p_day date)
returns setof jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or char_length(p_token)<40 or p_day is null
     or p_day <> (clock_timestamp() at time zone 'America/Santiago')::date then return; end if;
  if not exists (select 1 from portal_private.config conf
    where conf.id=1 and conf.cron_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then return; end if;
  return query
    with eligible as materialized (
      select s.id,s.subscription from public.portal_push_subscriptions s
      where not exists (
        select 1 from public.portal_delivery_log d
        where d.subscription_id=s.id and d.local_day=p_day
      ) order by s.created_at asc limit 500
    ), reserved as (
      insert into public.portal_delivery_log(subscription_id,local_day)
      select e.id,p_day from eligible e on conflict do nothing
      returning subscription_id
    )
    select jsonb_build_object('id',e.id,'subscription',e.subscription)
    from eligible e join reserved d on d.subscription_id=e.id;
end; $$;
revoke all on function public.portal_claim_daily_push_jobs(text,date) from public,anon,authenticated;
grant execute on function public.portal_claim_daily_push_jobs(text,date) to anon;

create or replace function public.portal_remove_dead_subscription(p_token text,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or char_length(p_token)<40 then return false; end if;
  if not exists (select 1 from portal_private.config conf
    where conf.id=1 and conf.cron_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then return false; end if;
  delete from public.portal_push_subscriptions where id=p_id;
  return found;
end; $$;
revoke all on function public.portal_remove_dead_subscription(text,uuid) from public,anon,authenticated;
grant execute on function public.portal_remove_dead_subscription(text,uuid) to anon;
