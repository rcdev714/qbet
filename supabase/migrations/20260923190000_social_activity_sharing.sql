-- Social feed privacy shared by Expo (qbet) and web (react-anymarket).
--
-- Contract:
--   users.show_activity_on_feed (default true so existing follower activity stays visible).
--   This is not users.is_discoverable (people directory) and it does not change
--   update_own_privacy(boolean, text).
--   get_social_feed(p_mode, p_limit, p_offset, p_types)
--     discover  — other users who left the flag on. Used when the viewer follows nobody.
--     following — only users the viewer follows who left the flag on.
--     auto      — following when the viewer follows anyone, otherwise discover.
--   get_following_activity_v2 keeps its signature and now applies the same flag.
--   get_profile_activity — owner always; everyone else only when show_activity_logs is on.
--   show_open_bets / show_results gate stranger reads of those bet rows.
--   show_verified_badge may add a badge when kyc_status is verified. No documents or PII.
--   set_show_activity_on_feed — feed flag only.
--   set_profile_section_privacy — profile section flags. Does not change update_own_privacy.
--
-- Apply on the database the client uses (Expo project jweyqlcvvmdyyqgqcsjd,
-- web project ztqunamafyvathalyrxp). Do not fork a second feed RPC.

begin;

alter table public.users
  add column if not exists show_activity_on_feed boolean not null default true,
  add column if not exists show_open_bets boolean not null default true,
  add column if not exists show_results boolean not null default true,
  add column if not exists show_activity_logs boolean not null default true,
  add column if not exists show_verified_badge boolean not null default false;

comment on column public.users.show_activity_on_feed is
  'When false, Discover and Following omit this user. Does not by itself hide profile sections.';
comment on column public.users.show_open_bets is
  'When false, other people cannot read this user''s open public-market bets.';
comment on column public.users.show_results is
  'When false, other people cannot read this user''s resolved or closed public-market bets.';
comment on column public.users.show_activity_logs is
  'When false, other people cannot read this user''s profile activity log. The owner still can.';
comment on column public.users.show_verified_badge is
  'When true and KYC status is verified, public profiles may show a badge. Never exposes documents or PII.';

-- ---------------------------------------------------------------------------
-- Who may appear
-- ---------------------------------------------------------------------------

create or replace function public.social_feed_includes_actor(
  p_viewer uuid,
  p_mode text,
  p_profile_user uuid,
  p_actor uuid,
  p_share boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_actor is null then false
    when p_mode = 'profile' then
      p_actor = p_profile_user
      and (
        p_actor = p_viewer
        or coalesce(
          (select u.show_activity_logs from public.users u where u.id = p_actor),
          true
        )
      )
    when coalesce(p_share, true) is not true or p_actor = p_viewer then false
    when p_mode = 'discover' then true
    when p_mode = 'following' then exists (
      select 1
      from public.user_follows uf
      where uf.follower_id = p_viewer
        and uf.following_id = p_actor
    )
    else false
  end;
$$;

revoke all on function public.social_feed_includes_actor(uuid, text, uuid, uuid, boolean)
  from public, anon, authenticated;

-- Discover never lists a private group. A stranger's profile shows a group only
-- when it is discoverable or the viewer is already a member. Following keeps
-- the previous timeline: non-DM groups from people you follow.
create or replace function public.social_feed_group_visible(
  p_viewer uuid,
  p_mode text,
  p_profile_user uuid,
  p_username text,
  p_group_id uuid,
  p_discoverable boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_mode = 'discover' then
      p_username is not null
      and p_username not like 'deleted\_%' escape '\'
      and coalesce(p_discoverable, false)
    when p_mode = 'profile' and p_profile_user is distinct from p_viewer then
      coalesce(p_discoverable, false)
      or exists (
        select 1
        from public.group_members gm
        where gm.group_id = p_group_id
          and gm.user_id = p_viewer
      )
    else true
  end;
$$;

revoke all on function public.social_feed_group_visible(uuid, text, uuid, text, uuid, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activity rows
-- ---------------------------------------------------------------------------

create or replace function public.social_activity_query(
  p_viewer uuid,
  p_mode text,
  p_profile_user uuid,
  p_limit int,
  p_offset int,
  p_types text[]
)
returns table (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  market_status text,
  market_yes_pct numeric,
  side text,
  bet_amount numeric,
  profit_loss numeric,
  group_id uuid,
  group_name text,
  is_member boolean,
  comment_preview text,
  outcome text,
  actor_total_bets int,
  actor_win_rate numeric,
  actor_current_streak int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if p_viewer is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_mode = 'profile' and p_profile_user is not null and p_profile_user <> p_viewer then
    if coalesce(
      (select u.show_activity_logs from public.users u where u.id = p_profile_user),
      true
    ) is not true then
      return;
    end if;
  end if;

  return query
  with activities as (
    select
      b.id as activity_id,
      u.id as user_id,
      u.username,
      u.avatar_url,
      'bet_placed'::text as activity_type,
      m.id as market_id,
      case
        when m.group_id is not null
          and coalesce(m.is_public, false) = false
          and not exists (
            select 1 from public.group_members gm
            where gm.group_id = m.group_id and gm.user_id = p_viewer
          )
        then 'Private group market'
        else m.question
      end as market_question,
      m.status::text as market_status,
      (
        select case
          when coalesce(sum(o.total_pool), 0) <= 0 then 50
          else round(
            (coalesce(sum(o.total_pool) filter (where o.label ilike 'yes'), 0) / sum(o.total_pool)) * 100,
            1
          )
        end
        from public.options o
        where o.market_id = m.id
      ) as market_yes_pct,
      b.side,
      case
        when m.group_id is not null
          and coalesce(m.is_public, false) = false
          and not exists (
            select 1 from public.group_members gm
            where gm.group_id = m.group_id and gm.user_id = p_viewer
          )
        then null::numeric
        else b.amount
      end as bet_amount,
      null::numeric as profit_loss,
      case
        when m.group_id is not null
          and (
            coalesce(m.is_public, false) = true
            or exists (
              select 1 from public.group_members gm
              where gm.group_id = m.group_id and gm.user_id = p_viewer
            )
            or exists (
              select 1 from public.groups g
              where g.id = m.group_id and g.is_discoverable = true
            )
          )
        then m.group_id
        else null::uuid
      end as group_id,
      case
        when m.group_id is not null
          and (
            coalesce(m.is_public, false) = true
            or exists (
              select 1 from public.group_members gm
              where gm.group_id = m.group_id and gm.user_id = p_viewer
            )
            or exists (
              select 1 from public.groups g
              where g.id = m.group_id and g.is_discoverable = true
            )
          )
        then (select g.name from public.groups g where g.id = m.group_id)
        else null::text
      end as group_name,
      false as is_member,
      null::text as comment_preview,
      null::text as outcome,
      coalesce(us.total_bets, 0) as actor_total_bets,
      coalesce(us.win_rate, 0) as actor_win_rate,
      coalesce(us.current_streak, 0) as actor_current_streak,
      b.placed_at as created_at
    from public.bets b
    join public.users u on u.id = b.user_id
    join public.markets m on m.id = b.market_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and (
        p_mode <> 'discover'
        or (u.username is not null and u.username not like 'deleted\_%' escape '\')
      )
      and b.placed_at >= now() - interval '30 days'
      and (
        m.group_id is null
        or coalesce(m.is_public, false) = true
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = m.group_id and gm.user_id = p_viewer
        )
      )

    union all

    select
      b.id,
      u.id,
      u.username,
      u.avatar_url,
      case
        when (
          b.option_id = m.winning_option_id
          or (b.side = 'yes' and o.label ilike 'yes')
          or (b.side = 'no' and o.label ilike 'no')
        ) then 'bet_won'
        else 'bet_lost'
      end,
      m.id,
      case
        when m.group_id is not null
          and coalesce(m.is_public, false) = false
          and not exists (
            select 1 from public.group_members gm
            where gm.group_id = m.group_id and gm.user_id = p_viewer
          )
        then 'Private group market'
        else m.question
      end,
      m.status::text,
      null::numeric,
      b.side,
      case
        when m.group_id is not null
          and coalesce(m.is_public, false) = false
          and not exists (
            select 1 from public.group_members gm
            where gm.group_id = m.group_id and gm.user_id = p_viewer
          )
        then null::numeric
        else b.amount
      end,
      case
        when (
          b.option_id = m.winning_option_id
          or (b.side = 'yes' and o.label ilike 'yes')
          or (b.side = 'no' and o.label ilike 'no')
        ) then b.amount
        else -b.amount
      end,
      case
        when m.group_id is not null
          and (
            coalesce(m.is_public, false) = true
            or exists (
              select 1 from public.group_members gm
              where gm.group_id = m.group_id and gm.user_id = p_viewer
            )
          )
        then m.group_id
        else null::uuid
      end,
      case
        when m.group_id is not null
          and (
            coalesce(m.is_public, false) = true
            or exists (
              select 1 from public.group_members gm
              where gm.group_id = m.group_id and gm.user_id = p_viewer
            )
          )
        then (select g.name from public.groups g where g.id = m.group_id)
        else null::text
      end,
      false,
      null::text,
      case
        when (
          b.option_id = m.winning_option_id
          or (b.side = 'yes' and o.label ilike 'yes')
          or (b.side = 'no' and o.label ilike 'no')
        ) then 'won'
        else 'lost'
      end,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      coalesce(m.resolved_at, m.updated_at, b.placed_at)
    from public.bets b
    join public.users u on u.id = b.user_id
    join public.markets m on m.id = b.market_id
    left join public.options o on o.id = b.option_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and (
        p_mode <> 'discover'
        or (u.username is not null and u.username not like 'deleted\_%' escape '\')
      )
      and m.status = 'resolved'
      and coalesce(m.resolved_at, m.updated_at) >= now() - interval '30 days'
      and (
        m.group_id is null
        or coalesce(m.is_public, false) = true
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = m.group_id and gm.user_id = p_viewer
        )
      )

    union all

    select
      msg.id,
      u.id,
      u.username,
      u.avatar_url,
      'market_comment'::text,
      m.id,
      m.question,
      m.status::text,
      (
        select case
          when coalesce(sum(o.total_pool), 0) <= 0 then 50
          else round(
            (coalesce(sum(o.total_pool) filter (where o.label ilike 'yes'), 0) / sum(o.total_pool)) * 100,
            1
          )
        end
        from public.options o
        where o.market_id = m.id
      ),
      null::text,
      null::numeric,
      null::numeric,
      null::uuid,
      null::text,
      false,
      left(msg.content, 140),
      null::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      msg.created_at
    from public.market_chat_messages msg
    join public.users u on u.id = msg.user_id
    join public.markets m on m.id = msg.market_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and (
        p_mode <> 'discover'
        or (u.username is not null and u.username not like 'deleted\_%' escape '\')
      )
      and coalesce(m.is_public, false) = true
      and msg.created_at >= now() - interval '30 days'

    union all

    select
      m.id,
      u.id,
      u.username,
      u.avatar_url,
      'market_posted'::text,
      m.id,
      m.question,
      m.status::text,
      (
        select case
          when coalesce(sum(o.total_pool), 0) <= 0 then 50
          else round(
            (coalesce(sum(o.total_pool) filter (where o.label ilike 'yes'), 0) / sum(o.total_pool)) * 100,
            1
          )
        end
        from public.options o
        where o.market_id = m.id
      ),
      null::text,
      null::numeric,
      null::numeric,
      case when coalesce(g.is_discoverable, false) or coalesce(m.is_public, false) then m.group_id else null::uuid end,
      case when coalesce(g.is_discoverable, false) or coalesce(m.is_public, false) then g.name else null::text end,
      false,
      null::text,
      null::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      m.created_at
    from public.markets m
    join public.users u on u.id = m.creator_id
    left join public.groups g on g.id = m.group_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and (
        p_mode <> 'discover'
        or (u.username is not null and u.username not like 'deleted\_%' escape '\')
      )
      and coalesce(m.is_public, false) = true
      and m.created_at >= now() - interval '30 days'

    union all

    select
      g.id,
      u.id,
      u.username,
      u.avatar_url,
      'group_created'::text,
      null::uuid,
      null::text,
      null::text,
      null::numeric,
      null::text,
      null::numeric,
      null::numeric,
      g.id,
      g.name,
      exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = p_viewer
      ),
      null::text,
      null::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      g.created_at
    from public.groups g
    join public.users u on u.id = g.admin_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and public.social_feed_group_visible(p_viewer, p_mode, p_profile_user, u.username, g.id, g.is_discoverable)
      and coalesce(g.is_dm, false) = false
      and g.created_at >= now() - interval '30 days'

    union all

    select
      md5(gm.user_id::text || ':' || gm.group_id::text || ':joined')::uuid,
      u.id,
      u.username,
      u.avatar_url,
      'group_joined'::text,
      null::uuid,
      null::text,
      null::text,
      null::numeric,
      null::text,
      null::numeric,
      null::numeric,
      g.id,
      g.name,
      exists (
        select 1 from public.group_members gm2
        where gm2.group_id = g.id and gm2.user_id = p_viewer
      ),
      null::text,
      null::text,
      coalesce(us.total_bets, 0),
      coalesce(us.win_rate, 0),
      coalesce(us.current_streak, 0),
      gm.joined_at
    from public.group_members gm
    join public.users u on u.id = gm.user_id
    join public.groups g on g.id = gm.group_id
    left join public.user_stats us on us.user_id = u.id
    where public.social_feed_includes_actor(
      p_viewer, p_mode, p_profile_user, u.id, coalesce(u.show_activity_on_feed, true)
    )
      and public.social_feed_group_visible(p_viewer, p_mode, p_profile_user, u.username, g.id, g.is_discoverable)
      and coalesce(g.is_dm, false) = false
      and gm.joined_at >= now() - interval '30 days'
      and gm.user_id <> g.admin_id
  )
  select *
  from activities a
  where p_types is null or a.activity_type = any (p_types)
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 0), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

revoke all on function public.social_activity_query(uuid, text, uuid, int, int, text[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_social_feed(
  p_mode text default 'auto',
  p_limit int default 30,
  p_offset int default 0,
  p_types text[] default null
)
returns table (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  market_status text,
  market_yes_pct numeric,
  side text,
  bet_amount numeric,
  profit_loss numeric,
  group_id uuid,
  group_name text,
  is_member boolean,
  comment_preview text,
  outcome text,
  actor_total_bets int,
  actor_win_rate numeric,
  actor_current_streak int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode text := lower(coalesce(nullif(btrim(p_mode), ''), 'auto'));
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_mode = 'auto' then
    if exists (select 1 from public.user_follows uf where uf.follower_id = v_user_id) then
      v_mode := 'following';
    else
      v_mode := 'discover';
    end if;
  end if;

  if v_mode not in ('discover', 'following') then
    raise exception 'Invalid feed mode' using errcode = '22023';
  end if;

  return query
  select *
  from public.social_activity_query(v_user_id, v_mode, null, p_limit, p_offset, p_types);
end;
$function$;

create or replace function public.get_profile_activity(
  p_user_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  market_status text,
  market_yes_pct numeric,
  side text,
  bet_amount numeric,
  profit_loss numeric,
  group_id uuid,
  group_name text,
  is_member boolean,
  comment_preview text,
  outcome text,
  actor_total_bets int,
  actor_win_rate numeric,
  actor_current_streak int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_user_id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return query
  select *
  from public.social_activity_query(v_user_id, 'profile', p_user_id, p_limit, p_offset, null);
end;
$function$;

create or replace function public.get_following_activity_v2(
  p_limit int default 30,
  p_offset int default 0,
  p_types text[] default null
)
returns table (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  market_status text,
  market_yes_pct numeric,
  side text,
  bet_amount numeric,
  profit_loss numeric,
  group_id uuid,
  group_name text,
  is_member boolean,
  comment_preview text,
  outcome text,
  actor_total_bets int,
  actor_win_rate numeric,
  actor_current_streak int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  return query
  select *
  from public.get_social_feed('following', p_limit, p_offset, p_types);
end;
$function$;

create or replace function public.get_following_activity(p_limit int default 30)
returns table (
  activity_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  activity_type text,
  market_id uuid,
  market_question text,
  side text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  return query
  select
    b.id as activity_id,
    u.id as user_id,
    u.username,
    u.avatar_url,
    'bet_placed'::text as activity_type,
    m.id as market_id,
    m.question as market_question,
    b.side,
    b.placed_at as created_at
  from public.bets b
  join public.users u on u.id = b.user_id
  join public.markets m on m.id = b.market_id
  where b.user_id in (
    select uf.following_id
    from public.user_follows uf
    join public.users fu on fu.id = uf.following_id
    where uf.follower_id = v_user_id
      and coalesce(fu.show_activity_on_feed, true) = true
  )
    and b.placed_at >= now() - interval '7 days'
  order by b.placed_at desc
  limit p_limit;
end;
$function$;

create or replace function public.profile_activity_is_visible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    when auth.uid() = p_user_id then true
    else coalesce(
      (select u.show_activity_logs from public.users u where u.id = p_user_id),
      false
    )
  end;
$$;

create or replace function public.set_show_activity_on_feed(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_enabled boolean := coalesce(p_enabled, false);
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.users
  set show_activity_on_feed = v_enabled
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_enabled;
end;
$$;

-- Strangers read a public-market bet only when that profile section is on.
-- Open markets follow show_open_bets. Anything else follows show_results.
-- Feed RPCs are security definer and still use show_activity_on_feed.
-- Own bets and group-member reads stay.
drop policy if exists "Users can view bets" on public.bets;
create policy "Users can view bets"
  on public.bets
  for select
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.markets m
      join public.users u on u.id = bets.user_id
      where m.id = bets.market_id
        and m.is_public = true
        and (
          (m.status = 'open' and coalesce(u.show_open_bets, true))
          or (m.status is distinct from 'open' and coalesce(u.show_results, true))
        )
    )
    or exists (
      select 1
      from public.markets m
      join public.group_members gm on gm.group_id = m.group_id
      where m.id = bets.market_id
        and gm.user_id = (select auth.uid())
    )
  );

create or replace function public.get_profile_privacy(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner boolean;
  v_open boolean;
  v_results boolean;
  v_logs boolean;
  v_badge_pref boolean;
  v_feed boolean;
  v_kyc text;
  v_badge boolean;
begin
  if v_viewer is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_user_id is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  select
    coalesce(u.show_open_bets, true),
    coalesce(u.show_results, true),
    coalesce(u.show_activity_logs, true),
    coalesce(u.show_verified_badge, false),
    coalesce(u.show_activity_on_feed, true)
  into v_open, v_results, v_logs, v_badge_pref, v_feed
  from public.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  v_owner := v_viewer = p_user_id;

  -- Status word only. Do not select metadata, sessions, documents, or provider ids.
  select ucp.kyc_status into v_kyc
  from public.user_compliance_profiles ucp
  where ucp.user_id = p_user_id;

  v_badge := v_badge_pref and v_kyc = 'verified';

  if v_owner then
    return jsonb_build_object(
      'is_owner', true,
      'verified_badge', v_badge,
      'kyc_status', coalesce(v_kyc, 'not_started'),
      'settings', jsonb_build_object(
        'show_activity_on_feed', v_feed,
        'show_open_bets', v_open,
        'show_results', v_results,
        'show_activity_logs', v_logs,
        'show_verified_badge', v_badge_pref
      ),
      'sections', jsonb_build_object(
        'settings', true,
        'kyc_status', true,
        'activity_logs', true,
        'open_bets', true,
        'results', true
      )
    );
  end if;

  return jsonb_build_object(
    'is_owner', false,
    'verified_badge', v_badge,
    'sections', jsonb_build_object(
      'settings', false,
      'kyc_status', false,
      'activity_logs', v_logs,
      'open_bets', v_open,
      'results', v_results
    )
  );
end;
$$;

create or replace function public.set_profile_section_privacy(
  p_show_open_bets boolean,
  p_show_results boolean,
  p_show_activity_logs boolean,
  p_show_verified_badge boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.users
  set
    show_open_bets = coalesce(p_show_open_bets, false),
    show_results = coalesce(p_show_results, false),
    show_activity_logs = coalesce(p_show_activity_logs, false),
    show_verified_badge = coalesce(p_show_verified_badge, false)
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return public.get_profile_privacy(v_user_id);
end;
$$;

revoke all on function public.get_social_feed(text, int, int, text[]) from public, anon;
revoke all on function public.get_profile_activity(uuid, int, int) from public, anon;
revoke all on function public.get_following_activity_v2(int, int, text[]) from public, anon;
revoke all on function public.get_following_activity(int) from public, anon;
revoke all on function public.set_show_activity_on_feed(boolean) from public, anon;
revoke all on function public.get_profile_privacy(uuid) from public, anon;
revoke all on function public.set_profile_section_privacy(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.profile_activity_is_visible(uuid) from public;

grant execute on function public.get_social_feed(text, int, int, text[]) to authenticated;
grant execute on function public.get_profile_activity(uuid, int, int) to authenticated;
grant execute on function public.get_following_activity_v2(int, int, text[]) to authenticated;
grant execute on function public.get_following_activity(int) to authenticated;
grant execute on function public.set_show_activity_on_feed(boolean) to authenticated;
grant execute on function public.get_profile_privacy(uuid) to authenticated;
grant execute on function public.set_profile_section_privacy(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.profile_activity_is_visible(uuid) to anon, authenticated;

commit;
