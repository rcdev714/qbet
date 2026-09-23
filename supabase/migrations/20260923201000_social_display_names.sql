-- Social display names and the shared sticker message shape.
--
-- Expo project: jweyqlcvvmdyyqgqcsjd. Web project: ztqunamafyvathalyrxp.
-- Apply on the database the client uses. Do not apply the web settings
-- migration (20260923010000) here: it also changes groups, invites, and privacy.
--
-- Names
--   users.display_name is the public label. It is not unique (web allows duplicates).
--   users.username stays the unique handle (existing users_username_key).
--   A missing username on insert becomes AdjectiveNoun## (Twitch-style).
--   A missing display name is filled from that pair, or copied from an existing username.
--   Existing usernames are not replaced.
--   update_own_profile(text, text, text, text) is the shared write. Nulls clear fields.
--   Direct grants still omit display_name, so clients must use the RPC.
--
-- Stickers
--   Clients send sticker rows with message_type = 'sticker' and content sticker:<pack>:<slug>.
--   No custom upload. Unknown pack or slug is still a sticker, not chat text.
--
-- This does not change wallet balances.

begin;

alter table public.users
  add column if not exists display_name text;

comment on column public.users.display_name is
  'Public social label. Not unique. The unique handle is username. Signup fills a missing name with AdjectiveNoun##.';

-- ---------------------------------------------------------------------------
-- Generator. Revoked from clients. Same adjective and noun lists as the app.
-- ---------------------------------------------------------------------------

create or replace function public.generate_social_name()
returns table (username text, display_name text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  adjectives text[] := array[
    'swift', 'lucky', 'bold', 'calm', 'keen', 'vivid', 'brave', 'witty',
    'merry', 'noble', 'rapid', 'solar', 'golden', 'quiet', 'bright', 'clever',
    'mighty', 'nimble', 'steady', 'wild', 'cozy', 'epic', 'cosmic', 'silver'
  ];
  nouns text[] := array[
    'otter', 'falcon', 'panda', 'comet', 'fox', 'heron', 'maple', 'nova',
    'pebble', 'robin', 'cedar', 'lynx', 'orca', 'quartz', 'raven', 'sage',
    'tiger', 'willow', 'badger', 'crane', 'dolphin', 'ember', 'gecko', 'ibis'
  ];
  v_adj text;
  v_noun text;
  v_num int;
  v_username text;
  v_display text;
  v_try int;
begin
  for v_try in 1..40 loop
    v_adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
    v_noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
    v_num := 10 + floor(random() * 90)::int;
    v_username := v_adj || v_noun || v_num::text;

    if not exists (
      select 1
      from public.users u
      where lower(u.username) = v_username
         or lower(u.display_name) = v_username
    ) then
      username := v_username;
      display_name := initcap(v_adj) || initcap(v_noun) || v_num::text;
      return next;
      return;
    end if;
  end loop;

  for v_try in 1..8 loop
    v_username := 'predictor' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1
      from public.users u
      where lower(u.username) = v_username
         or lower(u.display_name) = v_username
    );
  end loop;

  if v_username is null or exists (
    select 1
    from public.users u
    where lower(u.username) = v_username
       or lower(u.display_name) = v_username
  ) then
    v_username := 'predictor' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  end if;

  v_display := 'Predictor' || right(v_username, 6);
  username := left(v_username, 32);
  display_name := left(v_display, 80);
  return next;
end;
$$;

revoke all on function public.generate_social_name() from public, anon, authenticated;

create or replace function public.assign_social_name_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_display text;
begin
  if nullif(btrim(coalesce(new.username, '')), '') is null then
    select g.username, g.display_name
      into v_username, v_display
    from public.generate_social_name() g;
    new.username := v_username;
    new.display_name := coalesce(nullif(btrim(coalesce(new.display_name, '')), ''), v_display);
  elsif nullif(btrim(coalesce(new.display_name, '')), '') is null then
    new.display_name := new.username;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_social_name_on_insert() from public, anon, authenticated;

drop trigger if exists assign_social_name_on_insert on public.users;
create trigger assign_social_name_on_insert
  before insert on public.users
  for each row
  execute function public.assign_social_name_on_insert();

-- People who already have a username keep it. Only blank names are filled.
do $$
declare
  r record;
  v_username text;
  v_display text;
begin
  for r in
    select id
    from public.users
    where nullif(btrim(coalesce(username, '')), '') is null
  loop
    select g.username, g.display_name
      into v_username, v_display
    from public.generate_social_name() g;

    update public.users
    set
      username = v_username,
      display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_display)
    where id = r.id
      and nullif(btrim(coalesce(username, '')), '') is null;
  end loop;

  update public.users
  set display_name = username
  where nullif(btrim(coalesce(display_name, '')), '') is null
    and nullif(btrim(coalesce(username, '')), '') is not null;
end;
$$;

create or replace function public.ensure_social_display_name()
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user public.users;
  v_username text;
  v_display text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_user from public.users where id = v_user_id;
  if v_user.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if nullif(btrim(coalesce(v_user.username, '')), '') is null then
    select g.username, g.display_name
      into v_username, v_display
    from public.generate_social_name() g;

    update public.users
    set
      username = v_username,
      display_name = coalesce(nullif(btrim(coalesce(display_name, '')), ''), v_display)
    where id = v_user_id
    returning * into v_user;
  elsif nullif(btrim(coalesce(v_user.display_name, '')), '') is null then
    update public.users
    set display_name = v_user.username
    where id = v_user_id
    returning * into v_user;
  end if;

  return v_user;
end;
$$;

revoke all on function public.ensure_social_display_name() from public, anon;
grant execute on function public.ensure_social_display_name() to authenticated;

-- Same signature and checks as web update_own_profile. Passing null clears the field.
create or replace function public.update_own_profile(
  p_username text default null,
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user public.users;
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
  v_display text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_avatar text := nullif(btrim(coalesce(p_avatar_url, '')), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_username is not null and char_length(v_username) > 32 then
    raise exception 'Username is too long' using errcode = '22023';
  end if;
  if v_display is not null and char_length(v_display) > 80 then
    raise exception 'Display name is too long' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 280 then
    raise exception 'Bio is too long' using errcode = '22023';
  end if;
  if v_avatar is not null and char_length(v_avatar) > 2000 then
    raise exception 'Avatar URL is too long' using errcode = '22023';
  end if;

  update public.users
  set
    username = v_username,
    display_name = v_display,
    bio = v_bio,
    avatar_url = v_avatar
  where id = v_user_id
  returning * into v_user;

  if v_user.id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_user;
exception
  when unique_violation then
    raise exception 'Username is already taken' using errcode = '23505';
end;
$$;

revoke all on function public.update_own_profile(text, text, text, text) from public, anon;
grant execute on function public.update_own_profile(text, text, text, text) to authenticated;

-- Directory rows include the public label. Filters stay the Expo directory:
-- username present, not a deleted account, and not the viewer. No is_discoverable
-- column on this project.
drop function if exists public.list_discoverable_users(int, int);

create or replace function public.list_discoverable_users(
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  total_bets int,
  is_following boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    u.id as user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.created_at,
    coalesce(us.total_bets, 0)::int as total_bets,
    case
      when v_user_id is null then false
      else exists (
        select 1
        from public.user_follows uf
        where uf.follower_id = v_user_id
          and uf.following_id = u.id
      )
    end as is_following
  from public.users u
  left join public.user_stats us on us.user_id = u.id
  where u.username is not null
    and u.username not like 'deleted\_%'
    and (v_user_id is null or u.id <> v_user_id)
  order by u.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function public.list_discoverable_users(int, int) to authenticated, anon;

comment on column public.messages.message_type is
  'Includes text, image, market, shared cards, and sticker. Sticker content is sticker:<pack>:<slug> when message_type = ''sticker''.';

comment on column public.market_chat_messages.message_type is
  'Includes text, shared cards, and sticker. Sticker content is sticker:<pack>:<slug> when message_type = ''sticker''.';

commit;
