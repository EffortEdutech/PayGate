# Provider Capability Contract v1

Adapters declare features with constraints rather than a flat boolean matrix.

```yaml
contract_version: "1.0"
provider_id: stripe
capabilities:
  hosted_checkout:
    supported: true
    modes: [payment, subscription]
  customer_portal:
    supported: true
  native_subscriptions:
    supported: true
    intervals: [day, week, month, year]
    trials: true
  refunds:
    supported: true
    partial: true
  recurring_mandates:
    supported: true
  webhook_signatures:
    supported: true
```

An adapter must implement checkout creation, portal creation when declared, signature verification, event normalization, provider-state retrieval, error translation, and health diagnostics. Unsupported operations produce `CAPABILITY_NOT_SUPPORTED`.

Provider SDK types cannot cross the adapter boundary.

