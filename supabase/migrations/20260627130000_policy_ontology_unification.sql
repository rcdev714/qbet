begin;

-- ============================================================================
-- Phase 2: Policy ontology unification
-- Framework registry, locale-aware policy packs, category mapping.
-- ============================================================================

create table if not exists public.compliance_frameworks (
  id text primary key check (id in ('EC', 'US')),
  label text not null,
  default_currency text not null default 'USD',
  description text,
  created_at timestamptz not null default now()
);

insert into public.compliance_frameworks (id, label, description)
values
  (
    'EC',
    'Ecuador compliance framework',
    'Cautious non-sports future-event posture for Ecuador users.'
  ),
  (
    'US',
    'United States compliance framework',
    'United States legal disclosures and market rules for rest-of-world users.'
  )
on conflict (id) do update
  set label = excluded.label,
      description = excluded.description;

alter table public.policy_versions
  add column if not exists locale text not null default 'en'
  check (locale in ('en', 'es'));

-- Backfill locale on known Spanish packs
update public.policy_versions
set locale = 'es'
where version in ('2026-06-22-es-ec', '2026-06-24-es-us');

create unique index if not exists idx_policy_versions_active_required
  on public.policy_versions (jurisdiction, locale, kind)
  where is_required is true and retired_at is null;

create or replace function public.get_user_policy_locale(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(src.primary_ui_locale, 'en')
  from public.users u
  left join public.supported_residence_countries src
    on src.country_code = u.country_of_residence
  where u.id = p_user_id;
$$;

create or replace function public.has_current_policy_acceptances(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with user_context as (
    select
      public.get_user_compliance_jurisdiction(p_user_id) as jurisdiction,
      public.get_user_policy_locale(p_user_id) as locale
  ),
  required_policies as (
    select distinct on (pv.kind) pv.id, pv.kind
    from public.policy_versions pv
    cross join user_context uc
    where pv.is_required is true
      and pv.retired_at is null
      and pv.effective_at <= now()
      and pv.jurisdiction = uc.jurisdiction
      and pv.locale = uc.locale
    order by pv.kind, pv.effective_at desc, pv.created_at desc
  )
  select case
    when not exists (
      select 1 from public.users u
      where u.id = p_user_id and u.country_of_residence is not null
    ) then false
    when not exists (select 1 from required_policies) then false
    else not exists (
      select 1
      from required_policies rp
      where not exists (
        select 1
        from public.user_policy_acceptances upa
        where upa.user_id = p_user_id
          and upa.policy_version_id = rp.id
      )
    )
  end;
$$;

create table if not exists public.market_category_mappings (
  display_slug text primary key,
  display_label text not null,
  compliance_category_slug text not null,
  default_visibility text not null default 'private'
    check (default_visibility in ('private', 'public_feed', 'restricted')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.market_category_mappings (
  display_slug,
  display_label,
  compliance_category_slug,
  default_visibility,
  sort_order
)
values
  ('politics', 'Politics', 'politics', 'restricted', 1),
  ('tech', 'Tech', 'general_event', 'public_feed', 2),
  ('entertainment', 'Entertainment', 'general_event', 'public_feed', 3),
  ('general_event', 'General', 'general_event', 'private', 99)
on conflict (display_slug) do update
  set display_label = excluded.display_label,
      compliance_category_slug = excluded.compliance_category_slug,
      default_visibility = excluded.default_visibility,
      sort_order = excluded.sort_order;

alter table public.market_category_mappings enable row level security;

drop policy if exists "Market category mappings readable" on public.market_category_mappings;
create policy "Market category mappings readable"
  on public.market_category_mappings
  for select
  to authenticated, anon
  using (is_active is true);

create or replace function public.get_compliance_config(p_jurisdiction text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jurisdiction text := coalesce(
    p_jurisdiction,
    public.get_user_compliance_jurisdiction(auth.uid())
  );
  v_locale text := public.get_user_policy_locale(auth.uid());
  v_rules jsonb;
  v_categories jsonb;
  v_policies jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(cjr)), '[]'::jsonb)
  into v_rules
  from public.compliance_jurisdiction_rules cjr
  where cjr.jurisdiction = v_jurisdiction;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'display_slug', mcm.display_slug,
      'display_label', mcm.display_label,
      'compliance_category_slug', mcm.compliance_category_slug,
      'default_visibility', mcm.default_visibility,
      'sort_order', mcm.sort_order
    )
    order by mcm.sort_order
  ), '[]'::jsonb)
  into v_categories
  from public.market_category_mappings mcm
  where mcm.is_active is true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pv.id,
      'kind', pv.kind,
      'version', pv.version,
      'title', pv.title,
      'url', pv.url,
      'content_hash', pv.content_hash,
      'locale', pv.locale,
      'jurisdiction', pv.jurisdiction
    )
    order by pv.kind
  ), '[]'::jsonb)
  into v_policies
  from public.policy_versions pv
  where pv.is_required is true
    and pv.retired_at is null
    and pv.effective_at <= now()
    and pv.jurisdiction = v_jurisdiction
    and pv.locale = v_locale;

  return jsonb_build_object(
    'framework_id', v_jurisdiction,
    'locale', v_locale,
    'jurisdiction_rules', v_rules,
    'category_mappings', v_categories,
    'required_policies', v_policies
  );
end;
$$;

grant execute on function public.get_user_policy_locale(uuid) to authenticated, service_role;
grant execute on function public.get_compliance_config(text) to authenticated, service_role;

commit;
