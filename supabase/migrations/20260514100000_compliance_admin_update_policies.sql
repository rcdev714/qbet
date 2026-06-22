begin;
-- Admins need to update compliance profiles and market reviews from the app (authenticated JWT).
drop policy if exists "Admins update user compliance profiles" on public.user_compliance_profiles;
create policy "Admins update user compliance profiles"
  on public.user_compliance_profiles for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));
drop policy if exists "Admins update market compliance reviews" on public.market_compliance_reviews;
create policy "Admins update market compliance reviews"
  on public.market_compliance_reviews for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));
drop policy if exists "Admins insert regulatory report periods" on public.regulatory_report_periods;
create policy "Admins insert regulatory report periods"
  on public.regulatory_report_periods for insert
  to authenticated
  with check (public.is_app_admin(auth.uid()));
drop policy if exists "Admins update regulatory report periods" on public.regulatory_report_periods;
create policy "Admins update regulatory report periods"
  on public.regulatory_report_periods for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));
-- App admins must be able to set compliance_review_state / public_feed_allowed on any market.
drop policy if exists "markets_update_app_compliance" on public.markets;
create policy "markets_update_app_compliance"
  on public.markets for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));
commit;
