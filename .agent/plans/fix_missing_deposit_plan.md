# Implementation Plan - Fix Missing Deposit & Audit Balance

This plan outlines the steps to resolve the missing $3.33 deposit and address
the user's request to audit their wallet balance.

## User Review Required

> [!IMPORTANT]
> The transaction history audit reveals a net sum of **-$7,384.68** (due to
> untracked Admin "Add Funds" usage supporting large bets).
>
> - **Option A (Recommended):** Manually insert the missing $3.33 deposit. This
>   will update your current balance from $4.00 to $7.33.
> - **Option B (Dangerous):** Force recalculate balance from history. This will
>   set your balance to **negative** -$7,384.68.

## Proposed Changes

### Database Scripts

#### [NEW] `supabase/scripts/manual_deposit_3_33.sql`

- Creates a SQL script to safely insert the missing transaction and atomic
  update the wallet balance.
- Targets the user `juan.salgador@uisek.edu.ec` (admin) by default but is
  configurable.
- Sets `is_play_mode` to false explicitly.

#### [NEW] `supabase/scripts/recalculate_balance_cautious.sql`

- Creates a SQL script to calculate the strict sum of all historic transactions.
- Includes a prominent warning about the potential for negative balance due to
  untracked manual adjustments.
- Updates `wallets` table to match the calculated sum.

## Verification Plan

### Automated Tests

- None (Operational script)

### Manual Verification

- User executes `manual_deposit_3_33.sql` in Supabase SQL Editor.
- User verifies balance in App or Dashboard (should increase by $3.33).
