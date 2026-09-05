# Webhook and Event Processing Contract

Delivery is treated as at least once and potentially out of order.

Trusted inbox uniqueness:

```text
(provider_id, provider_account, environment, provider_event_id)
```

Processing states are `pending`, `processing`, `processed`, `retryable`, and `dead_letter`. Workers use leases, bounded exponential backoff with jitter, and a maximum-attempt policy. Handlers compare provider timestamps and object versions where available, and reconcile current provider state when event order is ambiguous.

All projection changes and outbox messages are committed in the same database transaction. Event payload retention and deletion are governed by an explicit retention policy; the audit record retains hashes and processing outcomes.

