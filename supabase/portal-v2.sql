-- Portal 3.º Medio A TP · expansión sin IA · migración aditiva
-- No modifica las identidades de administrador ni los datos escolares existentes.
-- Chat, archivos y datos personales bajo RLS: no accesibles a visitantes anónimos.

create or replace function public.portal_is_member() returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.portal_members m where m.user_id=(select auth.uid()))
     or exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin')
$$;
revoke all on function public.portal_is_member() from public,anon;
grant execute on function public.portal_is_member() to authenticated;

create table public.portal_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 2 and 40
  and display_name !~ '[<>]'
  and lower(display_name) !~ '(^|[[:space:]])(admin|administrador|profesor|docente)([[:space:]]|$)'),
 created_at timestamptz not null default now()
);
alter table public.portal_profiles enable row level security;
revoke all on public.portal_profiles from anon,authenticated;
grant select(user_id,display_name) on public.portal_profiles to authenticated;
grant insert(user_id,display_name),update(user_id,display_name) on public.portal_profiles to authenticated;
create policy portal_profiles_members_read on public.portal_profiles for select to authenticated
 using ((select public.portal_is_member()));
create policy portal_profiles_self_insert on public.portal_profiles for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.portal_is_member()));
create policy portal_profiles_self_update on public.portal_profiles for update to authenticated
 using(user_id=(select auth.uid()) and (select public.portal_is_member()))
 with check(user_id=(select auth.uid()) and (select public.portal_is_member()));

create table public.portal_messages(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 500 and body !~ '[<>]'),
 sent_at timestamptz not null default now(),
 constraint portal_no_self_dm check(sender_id<>recipient_id)
);
create index portal_dm_pair on public.portal_messages(sender_id,recipient_id,sent_at desc);
create index portal_dm_inbox on public.portal_messages(recipient_id,sent_at desc);
alter table public.portal_messages enable row level security;
revoke all on public.portal_messages from anon,authenticated;
grant select(id,sender_id,recipient_id,body,sent_at) on public.portal_messages to authenticated;
grant insert(sender_id,recipient_id,body) on public.portal_messages to authenticated;
create policy portal_dm_participants_read on public.portal_messages for select to authenticated
 using((select public.portal_is_member()) and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy portal_dm_sender_insert on public.portal_messages for insert to authenticated
 with check(
  sender_id=(select auth.uid()) and (select public.portal_is_member())
  and exists(select 1 from public.portal_profiles p where p.user_id=recipient_id)
  and not exists(select 1 from public.portal_messages old where old.sender_id=(select auth.uid()) and old.sent_at>now()-interval '60 seconds'
    group by old.sender_id having count(*)>=4)
 );

create table public.portal_message_reports(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.portal_messages(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(reason) between 5 and 300 and reason !~ '[<>]'),
 resolved boolean not null default false,
 created_at timestamptz not null default now(),
 unique(message_id,reporter_id)
);
alter table public.portal_message_reports enable row level security;
revoke all on public.portal_message_reports from anon,authenticated;
grant select(id,message_id,reporter_id,reason,resolved,created_at),
      insert(message_id,reporter_id,reason),update(resolved)
 on public.portal_message_reports to authenticated;
create policy portal_reports_read on public.portal_message_reports for select to authenticated
 using(reporter_id=(select auth.uid()) or exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy portal_reports_insert on public.portal_message_reports for insert to authenticated
 with check(reporter_id=(select auth.uid()) and (select public.portal_is_member())
  and exists(select 1 from public.portal_messages m where m.id=message_id and (m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid()))));
create policy portal_reports_admin_update on public.portal_message_reports for update to authenticated
 using(exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
 with check(exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

create table public.portal_polls(
 id uuid primary key default gen_random_uuid(),
 question text not null check(char_length(question) between 5 and 120 and question !~ '[<>]'),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 5),
 closes_at timestamptz,
 created_by uuid not null references auth.users(id) on delete cascade,
 is_closed boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.portal_polls enable row level security;
revoke all on public.portal_polls from anon,authenticated;
grant select(id,question,options,closes_at,created_at,created_by,is_closed),
      insert(question,options,closes_at,created_by),update(is_closed)
 on public.portal_polls to authenticated;
create policy portal_polls_members_read on public.portal_polls for select to authenticated using((select public.portal_is_member()));
create policy portal_polls_member_insert on public.portal_polls for insert to authenticated
 with check(created_by=(select auth.uid()) and (select public.portal_is_member()));
create policy portal_polls_admin_update on public.portal_polls for update to authenticated
 using(exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
 with check(exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

create table public.portal_poll_votes(
 poll_id uuid not null references public.portal_polls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 choice integer not null check(choice between 0 and 4),
 created_at timestamptz not null default now(),
 primary key(poll_id,user_id)
);
alter table public.portal_poll_votes enable row level security;
revoke all on public.portal_poll_votes from anon,authenticated;
grant select(poll_id,user_id,choice),insert(poll_id,user_id,choice) on public.portal_poll_votes to authenticated;
create policy portal_votes_self_read on public.portal_poll_votes for select to authenticated using(user_id=(select auth.uid()));
create policy portal_votes_one_per_user on public.portal_poll_votes for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.portal_is_member()) and exists(
  select 1 from public.portal_polls p where p.id=poll_id and not p.is_closed
   and (p.closes_at is null or p.closes_at>now()) and choice<jsonb_array_length(p.options)
 ));
create or replace function public.portal_poll_results(p_poll_id uuid)
returns table(choice integer,votes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.portal_members m where m.user_id=(select auth.uid()))
 and not exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin') then return; end if;
 if not exists(select 1 from public.portal_polls p where p.id=p_poll_id) then return; end if;
 return query select v.choice,count(*)::bigint from public.portal_poll_votes v
 where v.poll_id=p_poll_id group by v.choice order by v.choice;
end; $$;
revoke all on function public.portal_poll_results(uuid) from public,anon;
grant execute on function public.portal_poll_results(uuid) to authenticated;

create table public.portal_materials(
 id uuid primary key default gen_random_uuid(),
 uploader_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 3 and 120 and title !~ '[<>]'),
 subject text not null check(char_length(subject) between 1 and 100 and subject !~ '[<>]'),
 file_name text not null check(char_length(file_name) between 3 and 130 and file_name !~ '[<>/]'),
 object_path text not null unique check(char_length(object_path) between 40 and 200),
 size_bytes integer not null check(size_bytes>0 and size_bytes<=5242880),
 created_at timestamptz not null default now()
);
alter table public.portal_materials enable row level security;
revoke all on public.portal_materials from anon,authenticated;
grant select(id,uploader_id,title,subject,file_name,object_path,size_bytes,created_at),
      insert(uploader_id,title,subject,file_name,object_path,size_bytes),delete
 on public.portal_materials to authenticated;
create policy portal_materials_members_read on public.portal_materials for select to authenticated
 using((select public.portal_is_member()));
create policy portal_materials_members_insert on public.portal_materials for insert to authenticated
 with check(uploader_id=(select auth.uid()) and (select public.portal_is_member())
   and split_part(object_path,'/',1)=(select auth.uid())::text);
create policy portal_materials_author_delete on public.portal_materials for delete to authenticated
 using(uploader_id=(select auth.uid()) or exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portal-study-files','portal-study-files',false,5242880,ARRAY[
 'application/pdf','application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'text/plain','image/png','image/jpeg'
])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy portal_storage_member_read on storage.objects for select to authenticated
 using(bucket_id='portal-study-files' and (select public.portal_is_member()));
create policy portal_storage_member_upload on storage.objects for insert to authenticated
 with check(bucket_id='portal-study-files' and (select public.portal_is_member())
   and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy portal_storage_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='portal-study-files' and (select public.portal_is_member()) and
  ((storage.foldername(name))[1]=(select auth.uid())::text or
   exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin')));

create table public.portal_personal_state(
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=150000),
 updated_at timestamptz not null default now()
);
alter table public.portal_personal_state enable row level security;
revoke all on public.portal_personal_state from anon,authenticated;
grant select(user_id,data,updated_at),insert(user_id,data),update(user_id,data,updated_at)
 on public.portal_personal_state to authenticated;
create policy portal_personal_read on public.portal_personal_state for select to authenticated
 using(user_id=(select auth.uid()) and (select public.portal_is_member()));
create policy portal_personal_insert on public.portal_personal_state for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.portal_is_member()));
create policy portal_personal_update on public.portal_personal_state for update to authenticated
 using(user_id=(select auth.uid()) and (select public.portal_is_member()))
 with check(user_id=(select auth.uid()) and (select public.portal_is_member()));
create or replace function public.portal_touch_personal() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at:=now();return new;end; $$;
revoke all on function public.portal_touch_personal() from public,anon,authenticated;
create trigger portal_personal_touch before update on public.portal_personal_state
for each row execute function public.portal_touch_personal();

create table public.portal_daily_visits(
 user_id uuid not null references auth.users(id) on delete cascade,
 visit_day date not null,
 created_at timestamptz not null default now(),
 primary key(user_id,visit_day)
);
alter table public.portal_daily_visits enable row level security;
revoke all on public.portal_daily_visits from anon,authenticated;
grant select(user_id,visit_day),insert(user_id,visit_day) on public.portal_daily_visits to authenticated;
create policy portal_visit_self_select on public.portal_daily_visits for select to authenticated
 using(user_id=(select auth.uid()));
create policy portal_visit_self_insert on public.portal_daily_visits for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.portal_is_member())
  and visit_day=(now() at time zone 'America/Santiago')::date);

create or replace function public.portal_admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.portal_roles r where r.user_id=(select auth.uid()) and r.role='admin') then
  raise exception 'Acceso restringido';
 end if;
 return jsonb_build_object(
  'members',(select count(*) from public.portal_members),
  'profiles',(select count(*) from public.portal_profiles),
  'posts',(select count(*) from public.portal_posts where not is_deleted),
  'polls',(select count(*) from public.portal_polls),
  'votes',(select count(*) from public.portal_poll_votes),
  'messages',(select count(*) from public.portal_messages),
  'materials',(select count(*) from public.portal_materials),
  'visits_7d',(select count(*) from public.portal_daily_visits where visit_day>=(now() at time zone 'America/Santiago')::date-6),
  'daily_visitors',(select count(*) from public.portal_daily_visits where visit_day=(now() at time zone 'America/Santiago')::date),
  'pending_reports',(select count(*) from public.portal_message_reports where not resolved)
 );
end; $$;
revoke all on function public.portal_admin_metrics() from public,anon;
grant execute on function public.portal_admin_metrics() to authenticated;

-- Calendar supports class activities and deadlines in addition to exams.
alter table public.portal_posts drop constraint if exists portal_posts_kind_check;
alter table public.portal_posts add constraint portal_posts_kind_check check(kind in ('exam','notice','activity'));
alter table public.portal_posts drop constraint if exists portal_exam_date_required;
alter table public.portal_posts add constraint portal_exam_date_required
 check(kind not in ('exam','activity') or due_at is not null);

-- One immediate push per subscription/event; list of endpoints never exposed to browsers.
create table public.portal_event_delivery_log(
 post_id uuid not null references public.portal_posts(id) on delete cascade,
 subscription_id uuid not null references public.portal_push_subscriptions(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,subscription_id)
);
alter table public.portal_event_delivery_log enable row level security;
revoke all on public.portal_event_delivery_log from public,anon,authenticated;
create or replace function public.portal_claim_event_push_jobs(p_token text,p_post uuid)
returns setof jsonb language plpgsql security definer set search_path = '' as $$
begin
 if p_token is null or char_length(p_token)<40 or p_post is null then return;end if;
 if not exists(select 1 from portal_private.config c where c.id=1
  and c.cron_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then return;end if;
 if not exists(select 1 from public.portal_posts p where p.id=p_post and not p.is_deleted
  and p.created_at>now()-interval '10 minutes') then return;end if;
 return query with eligible as materialized(
  select s.id,s.subscription from public.portal_push_subscriptions s
  cross join public.portal_posts p
  where p.id=p_post and s.user_id<>p.created_by
  order by s.created_at asc limit 250
 ), reserved as(
  insert into public.portal_event_delivery_log(post_id,subscription_id)
  select p_post,e.id from eligible e on conflict do nothing returning subscription_id
 )
 select jsonb_build_object('id',e.id,'subscription',e.subscription)
 from eligible e join reserved r on r.subscription_id=e.id;
end; $$;
revoke all on function public.portal_claim_event_push_jobs(text,uuid) from public,authenticated;
grant execute on function public.portal_claim_event_push_jobs(text,uuid) to anon;

-- Avoid unintended API writes by anonymous visitors: only course members can use these tables.
