#!/bin/bash

# =============================================================================
# QBet Production Deployment Script
# =============================================================================
# This script helps you deploy to production with real Stripe payments.
#
# BEFORE RUNNING:
# 1. Get your LIVE Stripe keys from https://dashboard.stripe.com/apikeys
# 2. Create a LIVE webhook endpoint at https://dashboard.stripe.com/webhooks
#    - URL: https://jweyqlcvvmdyyqgqcsjd.supabase.co/functions/v1/stripe-webhook
#    - Events: payment_intent.succeeded, payment_intent.payment_failed,
#              account.updated, transfer.reversed, payout.failed, charge.refunded
# 3. Copy the webhook signing secret (whsec_...)
# =============================================================================

echo "🚀 QBet Production Deployment"
echo "=============================="
echo ""
echo "STEP 0: Run the pre-deploy gate first:"
echo "  npm run predeploy:prod"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

# =============================================================================
# STEP 1: Set Supabase Edge Function Secrets
# =============================================================================
# Replace the placeholder values with your LIVE keys before running!

echo "📦 Setting Supabase secrets..."
echo ""
echo "Run these commands with your LIVE keys:"
echo ""
echo "supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY"
echo "supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY"
echo "supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET"
echo "supabase secrets set RESEND_API_KEY=re_YOUR_PRODUCTION_RESEND_KEY"
echo "supabase secrets set RESEND_FROM_EMAIL=\"Anymarkt <onboarding@anymarkt.com>\""
echo "supabase secrets set WEB_PUSH_SUBJECT=mailto:support@anymarkt.com"
echo "supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarkt.com"
echo ""

# Uncomment and fill in your keys to run automatically:
# supabase secrets set STRIPE_SECRET_KEY=sk_live_XXXX
# supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_XXXX
# supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXX

# =============================================================================
# STEP 2: Verify secrets are set
# =============================================================================
echo "📋 Current Supabase secrets:"
supabase secrets list

# =============================================================================
# STEP 3: Deploy Supabase Edge Functions
# =============================================================================
echo ""
echo "🔄 Deploying Supabase functions..."
supabase functions deploy stripe-webhook
supabase functions deploy stripe-withdrawal
supabase functions deploy payment-sheet
supabase functions deploy customer-session
supabase functions deploy check-account-status
supabase functions deploy create-account-link
supabase functions deploy create-connect-account
supabase functions deploy onboarding-callback
supabase functions deploy update-connect-account
supabase functions deploy create-payout-setup
supabase functions deploy payout
supabase functions deploy send-beta-approval-email

# =============================================================================
# STEP 4: Apply database migration (removes admin bypass)
# =============================================================================
echo ""
echo "🗄️ Applying database migrations..."
supabase db push

# =============================================================================
# STEP 5: EAS Dashboard Configuration (Manual)
# =============================================================================
echo ""
echo "📱 EAS Dashboard Configuration"
echo "==============================="
echo "Go to https://expo.dev and set these secrets in your project:"
echo ""
echo "  EXPO_PUBLIC_APP_URL = https://anymarkt.com"
echo "  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_YOUR_LIVE_PUBLISHABLE_KEY"
echo ""
echo "The other EXPO_PUBLIC_* variables (SUPABASE_URL, SUPABASE_KEY) don't need changes."

# =============================================================================
# STEP 6: Build production app
# =============================================================================
echo ""
echo "🏗️ To build production apps, run:"
echo ""
echo "  eas build --profile production --platform ios"
echo "  eas build --profile production --platform android"
echo ""

echo "✅ Deployment preparation complete!"
echo ""
echo "⚠️  IMPORTANT: Test with a small real payment before going live!"
