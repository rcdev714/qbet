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
--   get_profile_activity — owner always; everyone else only when the flag is on.
--   set_show_activity_on_feed — the only client write path for the flag.
--
-- Apply on the database the client uses (Expo project jweyqlcvvmdyyqgqcsjd,
-- web project ztqunamafyvathalyrxp). Do not fork a second feed RPC.

begin;

alter table public.users
  add column if not exists show_activity_on_feed boolean not null default true;

comment on column public.users.show_activity_on_feed is
  'When false, Discover, Following, and stranger reads of public-market bets omit this user. The owner still sees their own profile activity.';

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
      and (p_actor = p_viewer or coalesce(p_share, true))
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
      (select u.show_activity_on_feed from public.users u where u.id = p_profile_user),
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
      (select u.show_activity_on_feed from public.users u where u.id = p_user_id),
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

-- Strangers can read public-market bets only when the bettor shares activity.
-- Own bets and group-member reads stay on their existing policies.
drop policy if exists "Users can view bets" on public.bets;
create policy "Users can view bets"
  on public.bets
  for select
  using (
    (select auth.uid()) = user_id
    or (
      exists (
        select 1
        from public.markets m
        where m.id = bets.market_id
          and m.is_public = true
      )
      and exists (
        select 1
        from public.users u
        where u.id = bets.user_id
          and coalesce(u.show_activity_on_feed, true) = true
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

revoke all on function public.get_social_feed(text, int, int, text[]) from public, anon;
revoke all on function public.get_profile_activity(uuid, int, int) from public, anon;
revoke all on function public.get_following_activity_v2(int, int, text[]) from public, anon;
revoke all on function public.get_following_activity(int) from public, anon;
revoke all on function public.set_show_activity_on_feed(boolean) from public, anon;
revoke all on function public.profile_activity_is_visible(uuid) from public;

grant execute on function public.get_social_feed(text, int, int, text[]) to authenticated;
grant execute on function public.get_profile_activity(uuid, int, int) to authenticated;
grant execute on function public.get_following_activity_v2(int, int, text[]) to authenticated;
grant execute on function public.get_following_activity(int) to authenticated;
grant execute on function public.set_show_activity_on_feed(boolean) to authenticated;
grant execute on function public.profile_activity_is_visible(uuid) to anon, authenticated;

commit;
