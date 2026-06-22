begin;
-- Existing public markets were given public_feed_allowed = false by the compliance migration default.
-- Restore visibility for already-published feed rows; new markets still get rules from upsert_market_compliance_review.
update public.markets
set public_feed_allowed = true
where is_public is true
  and public_feed_allowed is not true;
commit;
