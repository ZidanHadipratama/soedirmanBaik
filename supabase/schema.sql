-- Run in the Supabase SQL editor. Data access is server-only; the service key never reaches the browser.
create table if not exists public.posts (
  id uuid primary key, owner_id uuid not null, status text not null check (status in ('pending','approved','rejected','hidden')),
  created_at timestamptz not null default now(), published_at timestamptz, data jsonb not null,
  search_text text generated always as (coalesce(data->>'title','') || ' ' || coalesce(data->>'body','') || ' ' || coalesce(data->>'subject','')) stored
);
create index if not exists posts_feed on public.posts (status,published_at desc);
create index if not exists posts_owner on public.posts (owner_id);
create table if not exists public.assets (
  id uuid primary key, owner_id uuid not null, post_id uuid references public.posts(id), upload_id text unique, mux_asset_id text unique,
  created_at timestamptz not null default now(), data jsonb not null
);
create index if not exists assets_post on public.assets(post_id);
create table if not exists public.appreciations (post_id uuid references public.posts(id) on delete cascade, guest_id uuid not null, primary key(post_id,guest_id));
create table if not exists public.reports (post_id uuid references public.posts(id) on delete cascade, guest_id uuid not null, reason text not null, created_at timestamptz default now(), primary key(post_id,guest_id));
create table if not exists public.moderation_events (id uuid primary key default gen_random_uuid(), post_id uuid not null, action text not null, reason text not null, created_at timestamptz default now());
create table if not exists public.rate_limits (key text primary key, count integer not null, reset_at timestamptz not null);

alter table public.posts enable row level security;
alter table public.assets enable row level security;
alter table public.appreciations enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_events enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.posts,public.assets,public.appreciations,public.reports,public.moderation_events,public.rate_limits from anon,authenticated;
grant all on public.posts,public.assets,public.appreciations,public.reports,public.moderation_events,public.rate_limits to service_role;

create or replace function public.submit_post(post_data jsonb, asset_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare p_id uuid := (post_data->>'id')::uuid; actor uuid := (post_data->>'ownerId')::uuid; previous posts%rowtype; a assets%rowtype; n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_id::text));
  select * into previous from posts where id=p_id for update;
  if found and (previous.owner_id<>actor or previous.status='pending' or (previous.data->>'revision')::integer+1<>(post_data->>'revision')::integer) then raise exception 'conflict'; end if;
  if post_data->>'status'<>'pending' then raise exception 'conflict'; end if;
  select count(distinct v) into n from unnest(asset_ids) v;
  if n<>cardinality(asset_ids) or n>4 then raise exception 'conflict'; end if;
  if (post_data->>'kind'='photo' and n<1) or (post_data->>'kind'='video' and n<>1) or (post_data->>'kind' in ('article','link') and n<>0) then raise exception 'conflict'; end if;
  select count(*) into n from assets where id=any(asset_ids);
  if n<>cardinality(asset_ids) then raise exception 'conflict'; end if;
  for a in select * from assets where id=any(asset_ids) order by id for update loop
    if a.owner_id<>actor or (a.post_id is not null and a.post_id<>p_id) or a.data->>'status'='failed' then raise exception 'conflict'; end if;
    if (post_data->>'kind'='photo' and a.data->>'mime' not like 'image/%') or (post_data->>'kind'='video' and a.data->>'mime' not like 'video/%') then raise exception 'conflict'; end if;
  end loop;
  insert into posts(id,owner_id,status,created_at,published_at,data) values(p_id,actor,'pending',(post_data->>'createdAt')::timestamptz,null,post_data)
    on conflict(id) do update set status='pending',published_at=null,data=excluded.data;
  update assets set post_id=null,data=jsonb_set(data,'{postId}','null'::jsonb) where post_id=p_id and not(id=any(asset_ids));
  update assets set post_id=p_id,data=jsonb_set(data,'{postId}',to_jsonb(p_id::text)) where id=any(asset_ids);
end $$;

create or replace function public.moderate_post(post_id uuid,expected_revision integer,next_status text,review_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; publication timestamptz;
begin
  select * into p from posts where id=post_id for update;
  if not found or (p.data->>'revision')::integer<>expected_revision then raise exception 'conflict'; end if;
  if next_status not in ('approved','rejected','hidden') then raise exception 'conflict'; end if;
  if next_status in ('approved','rejected') and p.status<>'pending' then raise exception 'conflict'; end if;
  if next_status='approved' and exists(select 1 from assets where assets.post_id=p.id and data->>'status'<>'ready') then raise exception 'conflict'; end if;
  publication := case when next_status='approved' then now() else null end;
  update posts set status=next_status,published_at=publication,data=p.data || jsonb_build_object('status',next_status,'reason',review_reason,'publishedAt',publication) where id=p.id;
  insert into moderation_events(post_id,action,reason) values(p.id,next_status,review_reason);
end $$;

create or replace function public.toggle_appreciation(target_post uuid,actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare total integer; active boolean;
begin
  perform 1 from posts where id=target_post and status='approved' for update;
  if not found then raise exception 'post not published'; end if;
  delete from appreciations where post_id=target_post and guest_id=actor;
  active := not found;
  if active then insert into appreciations values(target_post,actor); end if;
  select count(*) into total from appreciations where post_id=target_post;
  return jsonb_build_object('count',total,'active',active);
end $$;

create or replace function public.consume_rate_limit(limit_key text,max_count integer,window_ms integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare actual integer;
begin
  delete from rate_limits where reset_at<now();
  insert into rate_limits values(limit_key,1,now() + make_interval(secs => window_ms / 1000.0))
    on conflict(key) do update set count=rate_limits.count+1 returning count into actual;
  return actual<=max_count;
end $$;
revoke all on function public.submit_post(jsonb,uuid[]),public.moderate_post(uuid,integer,text,text),public.toggle_appreciation(uuid,uuid),public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_post(jsonb,uuid[]),public.moderate_post(uuid,integer,text,text),public.toggle_appreciation(uuid,uuid),public.consume_rate_limit(text,integer,integer) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('post-media','post-media',false,10485760,array['image/webp'])
  on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
