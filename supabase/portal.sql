-- EXCLUSIVE Supabase project for Portal 3.º Medio A TP; do not apply to GameHub Ultra.
-- Run once in the SQL editor for a NEW school-only Supabase project.
-- Roles are assigned ONLY by a project owner through privileged SQL, never by the browser.

create table if not exists public.portal_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.portal_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create table if not exists public.portal_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('exam','notice')),
  title text not null check (char_length(title) between 3 and 120),
  subject text not null default 'General' check (char_length(subject) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_exam_date_required check (kind <> 'exam' or due_at is not null),
  constraint portal_no_html check (title !~ '[<>]' and subject !~ '[<>]' and description !~ '[<>]')
);
create index if not exists portal_posts_by_date on public.portal_posts(due_at) where kind = 'exam' and not is_deleted;
create index if not exists portal_posts_author_time on public.portal_posts(created_by,created_at desc);

create table if not exists public.portal_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 1800 and endpoint like 'https://%'),
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id,endpoint)
);
create table if not exists public.portal_delivery_log (
  subscription_id uuid not null references public.portal_push_subscriptions(id) on delete cascade,
  local_day date not null,
  created_at timestamptz not null default now(),
  primary key(subscription_id,local_day)
);

-- Reject excessive publication volume, including repeated inserts from one browser.
create or replace function public.portal_check_post_rate() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.portal_posts where created_by = new.created_by and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Límite de cinco publicaciones por 24 horas';
  end if;
  return new;
end; $$;
revoke all on function public.portal_check_post_rate() from public,anon,authenticated;
drop trigger if exists portal_posts_rate_limit on public.portal_posts;
create trigger portal_posts_rate_limit before insert on public.portal_posts for each row execute function public.portal_check_post_rate();

alter table public.portal_roles enable row level security;
alter table public.portal_members enable row level security;
alter table public.portal_posts enable row level security;
alter table public.portal_push_subscriptions enable row level security;
alter table public.portal_delivery_log enable row level security;

-- All privileges revoked by default; only the exact columns below are exposed to clients.
revoke all on public.portal_roles,public.portal_members,public.portal_posts,public.portal_push_subscriptions,public.portal_delivery_log from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select(user_id,role) on public.portal_roles to authenticated;
grant select(user_id) on public.portal_members to authenticated;
grant select(id,kind,title,subject,description,due_at,created_at,is_deleted) on public.portal_posts to anon,authenticated;
-- Rate-limit trigger runs as authenticated caller and needs this column to count own posts.
grant select(created_by) on public.portal_posts to authenticated;
grant insert(kind,title,subject,description,due_at,created_by) on public.portal_posts to authenticated;
grant update(kind,title,subject,description,due_at,is_deleted) on public.portal_posts to authenticated;
grant select,insert(user_id,endpoint,subscription),update(user_id,endpoint,subscription),delete on public.portal_push_subscriptions to authenticated;
-- Delivery logs intentionally have zero grants/policies to browser clients.

create policy portal_roles_read_self on public.portal_roles for select to authenticated using (user_id = (select auth.uid()));
create policy portal_members_read_self on public.portal_members for select to authenticated using (user_id = (select auth.uid()));
create policy portal_posts_public_read on public.portal_posts for select to anon,authenticated using (not is_deleted);
create policy portal_posts_members_insert on public.portal_posts for insert to authenticated
 with check (
   created_by = (select auth.uid()) and
   (exists (select 1 from public.portal_members m where m.user_id = (select auth.uid()))
    or exists (select 1 from public.portal_roles a where a.user_id = (select auth.uid()) and a.role = 'admin'))
 );
-- Only actual administrators may edit or soft-delete posts written by anyone.
create policy portal_posts_admin_update on public.portal_posts for update to authenticated
 using (not is_deleted and exists (select 1 from public.portal_roles a where a.user_id = (select auth.uid()) and a.role = 'admin'))
 with check (exists (select 1 from public.portal_roles a where a.user_id = (select auth.uid()) and a.role = 'admin'));
create policy portal_push_select_self on public.portal_push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy portal_push_insert_self on public.portal_push_subscriptions for insert to authenticated
 with check (user_id = (select auth.uid()) and
 (exists(select 1 from public.portal_members m where m.user_id=(select auth.uid())) or exists(select 1 from public.portal_roles a where a.user_id=(select auth.uid()) and a.role='admin')));
create policy portal_push_update_self on public.portal_push_subscriptions for update to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy portal_push_delete_self on public.portal_push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Bootstrap ONE admin after signing in by email-link on the portal:
-- insert into public.portal_roles(user_id,role)
-- select id,'admin' from auth.users where email = lower('REEMPLAZAR_CON_EL_CORREO_DEL_ADMIN')
-- on conflict (user_id) do update set role=excluded.role;
-- Never expose this SQL endpoint to students and never allow client role writes.
