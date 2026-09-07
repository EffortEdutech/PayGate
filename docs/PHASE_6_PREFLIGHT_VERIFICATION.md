# Phase 6 Track 2 - Preflight Verification

Status: partially verified; blocked from live execution until remaining operator-side checks are completed.
Date: 2026-09-07.

This document records the Phase 6 preflight evidence before any live checkout, real payment, live refund, or live reconciliation is attempted.

## Approved Live Pilot Scope

| Field | Value |
| --- | --- |
| PayGate URL | `https://pay-gate-beta.vercel.app` |
| Local repository commit checked | `166ff94` |
| App ID | `aintern` |
| App live URL from registry | `https://aintern.effortedutech.com` |
| Provider account alias | `nhl_global_solution` |
| Stripe account ID | `acct_1U4N6cRgCMXjT1y6` |
| Environment | `live` |
| Plan key | `pass_3m` |
| Amount | `MYR 39.00` |
| Checkout mode | `payment` / one-time |
| Stripe lookup key | `aintern_pass_3m` |
| user_ref | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` |
| Customer email | `effort.edutech@gmail.com` |
| Refund scope | `full` |
| Support / rollback owner | `NHL Global Solution operator` |
| Evidence location | `C:\Users\user\Documents\PayGate Phase 6 Evidence` |
| Live test window | `2026-09-07 21:00-22:00 MYT` |

## Checks Completed by Codex

| Check | Result | Evidence |
| --- | --- | --- |
| Local worktree clean before preflight | Pass | `git status --short` returned no changes. |
| Local commit identified | Pass | `166ff94 Complete Phase 6 approval draft scope`. |
| Registry app mapping reviewed | Pass | AIntern maps to `stripe:nhl_global_solution`. |
| Registry live URL reviewed | Pass | `https://aintern.effortedutech.com`. |
| Registry plan reviewed | Pass | `pass_3m`, MYR 39.00, one-time, lookup key `aintern_pass_3m`. |
| PayGate public health | Pass | `https://pay-gate-beta.vercel.app/health` returned `status=ok`, `runtime=vercel`. |
| Diagnostics anonymous protection | Pass | `https://pay-gate-beta.vercel.app/diagnostics/ready` returned HTTP 401 without token. |
| Admin anonymous protection | Pass | `https://pay-gate-beta.vercel.app/admin/summary` returned HTTP 401 without token. |
| Monitoring anonymous protection | Pass | `https://pay-gate-beta.vercel.app/admin/monitoring?app_id=aintern` returned HTTP 401 without token. |

## Checks Still Required Before Live Execution

These checks require operator access to Vercel, Stripe, or the operator token. They must be completed before any live checkout is created.

| Check | Required action | Where to verify |
| --- | --- | --- |
| Deployed commit SHA matches approved commit | Confirm Vercel production deployment is running commit `166ff94` or redeploy this commit and record the resulting SHA. | Vercel PayGate project -> Deployments -> current Production deployment -> Source commit. |
| Protected diagnostics with valid token | Call `/diagnostics/ready` using the operator token and confirm `status=ready`. | PowerShell with `Authorization: Bearer <OPERATOR_TOKEN>`, or browser/admin tool if supported. |
| Admin summary with valid token | Open `/admin/summary` or admin console using operator token and confirm app/provider/live readiness without secrets. | PayGate admin console or API with operator token. |
| Monitoring with valid token | Confirm no critical alerts before payment. Warnings must be understood and accepted. | `/admin/monitoring?app_id=aintern` with operator token. |
| Live provider env vars exist | Confirm live-only Vercel env vars are configured; do not reveal values. | Vercel Project Settings -> Environment Variables. |
| Live Stripe Product and Price exist | Confirm live Price lookup key `aintern_pass_3m` exists and amount is MYR 39.00. | Stripe Dashboard in live mode -> Product catalog -> AIntern 3-Month Pass -> Price. |
| Live webhook endpoint exists | Confirm endpoint URL is `https://pay-gate-beta.vercel.app/v1/webhooks/stripe/nhl_global_solution/live`. | Stripe Dashboard in live mode -> Developers -> Webhooks. |
| Live webhook secret stored server-side | Confirm the live `whsec_...` is stored only in Vercel env var `STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET`. | Vercel env vars; do not paste value into docs/chat. |
| Live secret key stored server-side | Confirm live secret key is stored only in `STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY`. | Vercel env vars; do not paste value into docs/chat. |
| Database backup/restore readiness | Confirm Supabase backup/restore point or manual rollback plan. | Supabase PayGate project -> Database backups/settings. |
| Evidence folder exists | Create `C:\Users\user\Documents\PayGate Phase 6 Evidence`. | Local Windows Explorer or PowerShell. |

## PowerShell Commands for Operator-Side Preflight

Use these only after setting the operator token in the current PowerShell session. Do not paste the token into chat.

```powershell
$operatorToken = "PASTE_OPERATOR_TOKEN_HERE"
$headers = @{ Authorization = "Bearer $operatorToken" }

Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/diagnostics/ready" -Headers $headers
Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/admin/summary" -Headers $headers
Invoke-RestMethod -Uri "https://pay-gate-beta.vercel.app/admin/monitoring?app_id=aintern" -Headers $headers
```

Expected result:

- diagnostics returns `status: ready`;
- admin summary lists AIntern and provider alias `nhl_global_solution` without secrets;
- monitoring has no critical alerts before live checkout.

## Phase 6 Track 2 Decision

Current decision: not ready for live execution yet.

Reason: Codex verified public/protection/registry checks, but operator-side checks requiring Vercel, Stripe live dashboard, and operator token remain pending.

## Stop Rule

Do not proceed to Phase 6 Track 3 live checkout until every required operator-side preflight check above is marked complete.