# Task: Fix Missing Deposit & Audit Balance

## Status

- [x] Create SQL script to insert missing $3.33 deposit <!-- id: 0 -->
  - Moved to migration:
    `supabase/migrations/20260209235106_fix_missing_deposit_3_33.sql`
- [x] Create SQL script for optional balance recalculation (with warnings)
      <!-- id: 1 -->
  - Kept as script: `supabase/scripts/force_recalculate_balance.sql`
- [ ] User to execute the Deposit Fix (Apply Migration) <!-- id: 2 -->
- [ ] Verify final balance <!-- id: 3 -->

## Context

The user made a
$3.33 production purchase via Stripe which is reflected in their bank/Stripe dashboard but **missing** from the `transactions` database table. This is likely due to a webhook failure (e.g., localhost environment not reachable by Stripe). Additionally, the user's transaction history shows a large negative net sum (-$7384)
due to untracked Admin "Add Funds" usage, meaning a simple recalculation from
history would result in a negative balance. The goal is to manually credit the
missing deposit and update the balance safely.

## Implementation Details

1. **Insert Missing Deposit**: Create a SQL script to insert a `deposit`
   transaction for $3.33 and atomically update the wallet balance.
2. **Recalculation Script**: Provide a script to recalculate balance from
   history, but with a strong warning that it will likely result in a negative
   balance due to the missing Admin Fund records.
