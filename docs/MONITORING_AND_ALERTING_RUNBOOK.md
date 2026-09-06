# Monitoring and Alerting Runbook

**Status:** baseline implemented  
**Scope:** Phase 4 Track 6 monitoring for PayGate sandbox/production-readiness operations.

## Purpose

PayGate must surface payment failures before users report them. The first baseline is an operator-visible monitoring summary that is protected behind the operator token and does not expose provider secrets or raw provider payloads.

## Protected Monitoring Endpoint

```text
GET /admin/monitoring
Authorization: Bearer <OPERATOR_DIAGNOSTICS_TOKEN>
```

Optional filters:

```text
?app_id=aintern&environment=test
```

The endpoint returns:

- `status`: `ok` or `attention_required`
- database reachability flag
- webhook inbox failure counts
- reconciliation failure counts
- operator alert list

## Alert Classes

Webhook alerts:

- `WEBHOOK_PENDING` - webhook events are inserted but not processed yet.
- `WEBHOOK_RETRYABLE` - webhook events are waiting for retry.
- `WEBHOOK_DEAD_LETTER` - webhook events reached dead-letter state and need operator action.

Reconciliation alerts:

- `RECONCILIATION_FAILED` - reconciliation failed and should be investigated.
- `RECONCILIATION_NO_PROVIDER_CUSTOMER` - no provider customer mapping was found.
- `RECONCILIATION_NO_PROVIDER_SUBSCRIPTION` - provider customer exists but no provider subscription was found.

Database alert:

- `DATABASE_UNREACHABLE` - database connectivity failed.

## Operator Procedure

1. Open `/admin`.
2. Enter the operator diagnostics token.
3. Confirm the Monitoring panel status.
4. If `attention_required`, inspect `/admin/summary` for affected customer, webhook, checkout, or reconciliation rows.
5. Use Stripe dashboard only for provider-side verification; do not copy provider secrets into tickets or docs.
6. If webhook failures exist, check Stripe webhook delivery logs for the same provider account and environment.
7. If reconciliation failures exist, rerun reconciliation only after confirming app/user/provider account scope.
8. If database connectivity fails, check Supabase status, Vercel env vars, and pooler connection settings.

## Current Baseline Limits

- Alerts are operator-visible in `/admin`; external push notifications are not configured yet.
- Email/Slack/WhatsApp alerting is deferred until the operator chooses an alert channel.
- Monitoring counts are safe aggregates and recent state, not a full incident management system.

## Future Alert Channel Decision

Before live payments, choose one alert route:

- email alert to operator;
- Vercel/Supabase dashboard monitoring plus manual check cadence;
- future messaging integration.

Live payments remain blocked until the monitoring baseline is accepted together with provider account isolation tests.