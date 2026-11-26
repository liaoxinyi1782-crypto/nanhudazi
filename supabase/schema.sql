-- Run once in Supabase Dashboard > SQL Editor.
-- This username-only prototype shares the board but does NOT authenticate student identity.
-- 12 digits are a user-supplied label; anyone can claim any value.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_username text not null check (owner_username ~ '^[0-9]{12}$'),
  owner_tag text not null check (char_length(owner_tag) between 6 and 20),
  category text not null check (category in ('餐饮','出行','学习','运动','团购','借物','闲置')),
  title text not null check (char_length(title) between 1 and 36),
  note text not null default '' check (char_length(note) <= 100),
  campus text not null check (char_length(campus) between 1 and 20),
  place text not null check (char_length(place) between 1 and 30),
  target_count integer not null check (target_count between 2 and 30),
  current_count integer not null check (current_count between 1 and target_count),
  created_at timestamptz not null default now()
);

create table if not exists public.post_participants (
  post_id uuid not null references public.posts(id) on delete cascade,
  username text not null check (username ~ '^[0-9]{12}$'),
  joined_at timestamptz not null default now(),
  primary key (post_id, username)
);

create table if not exists public.post_contacts (
  post_id uuid primary key references public.posts(id) on delete cascade,
  owner_username text not null check (owner_username ~ '^[0-9]{12}$'),
  contact text not null check (char_length(contact) between 1 and 60)
);

alter table public.posts enable row level security;
alter table public.post_participants enable row level security;
alter table public.post_contacts enable row level security;

revoke all on public.posts, public.post_participants, public.post_contacts from anon, authenticated;
grant select (id,owner_tag,category,title,note,campus,place,target_count,current_count,created_at) on public.posts to anon, authenticated;

drop policy if exists "anyone can read shared posts" on public.posts;
create policy "anyone can read shared posts"
  on public.posts for select to anon, authenticated using (true);

-- Clients cannot read contacts or write directly to tables. They use the validated RPCs below.

create or replace function public.create_post(
  p_username text, p_category text, p_title text, p_note text,
  p_campus text, p_place text, p_target_count integer,
  p_current_count integer, p_contact text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_post_id uuid;
begin
  if p_username !~ '^[0-9]{12}$' then raise exception '用户名必须是 12 位数字'; end if;
  if p_category not in ('餐饮','出行','学习','运动','团购','借物','闲置') then raise exception '分类无效'; end if;
  if char_length(trim(p_title)) not between 1 and 36 then raise exception '标题长度需在 1 到 36 字之间'; end if;
  if char_length(trim(p_note)) > 100 then raise exception '补充说明不能超过 100 字'; end if;
  if char_length(trim(p_campus)) not between 1 and 20 then raise exception '请填写校区'; end if;
  if char_length(trim(p_place)) not between 1 and 30 then raise exception '请填写具体地点'; end if;
  if p_target_count not between 2 and 30 then raise exception '目标人数需在 2 到 30 人之间'; end if;
  if p_current_count not between 1 and p_target_count then raise exception '当前人数不能超过目标人数'; end if;
  if char_length(trim(p_contact)) not between 1 and 60 then raise exception '请填写有效联系方式'; end if;
  insert into public.posts (owner_username,owner_tag,category,title,note,campus,place,target_count,current_count)
  values (p_username,'同学 ****' || right(p_username,4),p_category,trim(p_title),coalesce(trim(p_note),''),trim(p_campus),trim(p_place),p_target_count,p_current_count) returning id into v_post_id;
  insert into public.post_contacts (post_id,owner_username,contact) values (v_post_id,p_username,trim(p_contact));
  insert into public.post_participants (post_id,username) values (v_post_id,p_username);
  return v_post_id;
end; $$;

create or replace function public.join_post(p_post_id uuid,p_username text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_post public.posts%rowtype; v_contact text;
begin
  if p_username !~ '^[0-9]{12}$' then raise exception '用户名必须是 12 位数字'; end if;
  select * into v_post from public.posts where id=p_post_id for update;
  if not found then raise exception '拼单不存在'; end if;
  if v_post.owner_username <> p_username and not exists (select 1 from public.post_participants pp where pp.post_id=p_post_id and pp.username=p_username) then
    if v_post.current_count >= v_post.target_count then return pg_catalog.jsonb_build_object('full',true,'current_count',v_post.current_count,'target_count',v_post.target_count); end if;
    insert into public.post_participants (post_id,username) values (p_post_id,p_username) on conflict (post_id,username) do nothing;
    if found then update public.posts set current_count=current_count+1 where id=p_post_id returning * into v_post; end if;
  end if;
  select contact into v_contact from public.post_contacts where post_id=p_post_id;
  return pg_catalog.jsonb_build_object('full',false,'contact',v_contact,'current_count',v_post.current_count,'target_count',v_post.target_count);
end; $$;

create or replace function public.my_posts(p_username text)
returns table (id uuid,owner_tag text,category text,title text,note text,campus text,place text,target_count integer,current_count integer,created_at timestamptz,contact text)
language plpgsql security definer set search_path = ''
as $$
begin
  if p_username !~ '^[0-9]{12}$' then raise exception '用户名必须是 12 位数字'; end if;
  return query select p.id,p.owner_tag,p.category,p.title,p.note,p.campus,p.place,p.target_count,p.current_count,p.created_at,c.contact
  from public.posts p join public.post_contacts c on c.post_id=p.id where p.owner_username=p_username order by p.created_at desc;
end; $$;

revoke all on function public.create_post(text,text,text,text,text,text,integer,integer,text) from public,anon;
revoke all on function public.join_post(uuid,text) from public,anon;
revoke all on function public.my_posts(text) from public,anon;
grant execute on function public.create_post(text,text,text,text,text,text,integer,integer,text) to anon,authenticated;
grant execute on function public.join_post(uuid,text) to anon,authenticated;
grant execute on function public.my_posts(text) to anon,authenticated;
