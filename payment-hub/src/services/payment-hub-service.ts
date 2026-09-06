import { createHash } from "node:crypto";
import type { CheckoutResult, EntitlementProjection, PaymentProviderAdapter, PortalResult, ReconciliationResult, SubscriptionProjection, VerifiedProviderEvent } from "@payment-hub/contracts";
import type { Environment } from "@payment-hub/types";
import { Registry } from "../registry/registry.js";
import type { PaymentRepository } from "../persistence/repository.js";

export class PaymentHubService {
  constructor(
    readonly registry: Registry,
    readonly repository: PaymentRepository,
    readonly provider: PaymentProviderAdapter,
  ) {}

  catalog(appId: string, environment: Environment): unknown {
    const app = this.registry.application(appId);
    return {
      app_id: app.appId,
      provider_id: app.providerId,
      environment,
      plans: [...app.plans.values()].filter((plan) => plan.status === "active").map((plan) => ({
        plan_key: plan.planKey,
        name: plan.name,
        mode: plan.mode,
        amount_minor: plan.amountMinor,
        currency: plan.currency,
        interval: plan.interval,
        entitlements: plan.entitlements,
      })),
    };
  }

  async createCheckout(input: { readonly requestId: string; readonly appId: string; readonly userRef: string; readonly planKey: string; readonly returnContext: string; readonly environment: Environment }): Promise<CheckoutResult> {
    const app = this.registry.application(input.appId);
    const plan = this.registry.activePlan(input.appId, input.planKey);
    const urls = this.registry.returnUrls(input.appId, input.environment, input.returnContext);
    const providerLookupKey = plan.providerLookupKeys[`${app.providerId}:${input.environment}`] ?? plan.providerLookupKeys[app.providerId];
    if (!providerLookupKey) throw new PaymentHubServiceError("PROVIDER_LOOKUP_KEY_NOT_CONFIGURED", "Plan has no provider lookup key for this environment");
    const result = await this.provider.createCheckout({
      ...input,
      providerAccount: app.providerAccount,
      providerLookupKey,
      mode: plan.mode,
      money: { amountMinor: plan.amountMinor, currency: plan.currency },
      successUrl: urls.success,
      cancelUrl: urls.cancel,
    });
    await this.repository.saveCheckoutSession({ ...result, appId: app.appId, userRef: input.userRef, planKey: plan.planKey, providerId: app.providerId, providerAccount: app.providerAccount, environment: input.environment });
    return result;
  }

  async createPortal(input: { readonly requestId: string; readonly appId: string; readonly userRef: string; readonly returnContext: string; readonly environment: Environment }): Promise<PortalResult> {
    const app = this.registry.application(input.appId);
    const urls = this.registry.returnUrls(input.appId, input.environment, input.returnContext);
    const providerCustomerRef = await this.repository.findProviderCustomer({ appId: input.appId, userRef: input.userRef, providerId: app.providerId, providerAccount: app.providerAccount, environment: input.environment });
    if (!providerCustomerRef) throw new PaymentHubServiceError("PROVIDER_CUSTOMER_NOT_FOUND", "No provider customer exists for this application user");
    return this.provider.createPortalSession({ ...input, providerAccount: app.providerAccount, providerCustomerRef, returnUrl: urls.portal });
  }

  async acceptWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly providerAccount: string; readonly environment: Environment }): Promise<{ readonly duplicate: boolean; readonly event: VerifiedProviderEvent }> {
    const event = await this.provider.verifyWebhook({ rawBody: input.rawBody, signature: input.signature, account: input.providerAccount, environment: input.environment });
    const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
    const outcome = await this.repository.insertWebhookEvent(event, payloadHash);
    if (outcome === "inserted") await this.repository.applyVerifiedEvent(event);
    return { duplicate: outcome === "duplicate", event };
  }

  async reconcile(input: { readonly requestId: string; readonly appId: string; readonly userRef: string; readonly environment: Environment }): Promise<ReconciliationResult> {
    const app = this.registry.application(input.appId);
    const providerCustomerRef = await this.repository.findProviderCustomer({ appId: input.appId, userRef: input.userRef, providerId: app.providerId, providerAccount: app.providerAccount, environment: input.environment });
    if (!providerCustomerRef) {
      const subscription = await this.repository.currentSubscription(input.appId, input.userRef);
      const runId = await this.repository.recordReconciliationRun({ ...input, providerId: app.providerId, providerAccount: app.providerAccount, status: "no_provider_customer", evidence: { reason: "provider customer mapping missing" } });
      return { runId, appId: input.appId, userRef: input.userRef, status: "no_provider_customer", subscription };
    }
    const before = await this.repository.currentSubscription(input.appId, input.userRef);
    const snapshot = await this.provider.reconcileCustomer({ ...input, providerAccount: app.providerAccount, providerCustomerRef });
    const status = snapshot.state === "none" ? "no_provider_subscription" : sameSubscription(before, snapshot) ? "in_sync" : "repaired";
    const subscription = snapshot.state === "none" ? before : await this.repository.applyReconciliationSnapshot({ appId: input.appId, userRef: input.userRef, snapshot });
    const runId = await this.repository.recordReconciliationRun({ ...input, providerId: app.providerId, providerAccount: app.providerAccount, status, evidence: snapshot.evidence });
    return { runId, appId: input.appId, userRef: input.userRef, status, subscription };
  }


  async adminDashboard(input: { readonly appId?: string; readonly environment?: Environment; readonly limit?: number } = {}): Promise<unknown> {
    const apps = this.registry.applications()
      .filter((app) => !input.appId || app.appId === input.appId)
      .map((app) => ({
        app_id: app.appId,
        name: app.name,
        provider_id: app.providerId,
        provider_account: app.providerAccount,
        origins: Object.fromEntries(Object.entries(app.origins).map(([environment, origin]) => [environment, origin.href])),
        plans: [...app.plans.values()].map((plan) => ({
          plan_key: plan.planKey,
          name: plan.name,
          mode: plan.mode,
          amount_minor: plan.amountMinor,
          currency: plan.currency,
          interval: plan.interval,
          status: plan.status,
          entitlements: plan.entitlements,
          provider_lookup_configured: Object.keys(plan.providerLookupKeys).length > 0,
        })),
      }));
    const snapshot = await this.repository.adminDashboardSnapshot(input);
    return {
      generated_at: snapshot.generatedAt.toISOString(),
      apps,
      customers: snapshot.customers.map((customer) => ({
        app_id: customer.appId,
        user_ref: customer.userRef,
        created_at: customer.createdAt.toISOString(),
        provider_customers: customer.providerCustomers.map((providerCustomer) => ({
          provider_id: providerCustomer.providerId,
          provider_account: providerCustomer.providerAccount,
          environment: providerCustomer.environment,
          provider_customer_ref: providerCustomer.providerCustomerRef,
          created_at: providerCustomer.createdAt.toISOString(),
        })),
        subscription: customer.subscription ? serializeSubscription(customer.subscription) : { app_id: customer.appId, user_ref: customer.userRef, state: "none" },
        entitlements: customer.entitlements.map((entitlement) => ({ key: entitlement.key, state: entitlement.state, ...(entitlement.effectiveUntil ? { effective_until: entitlement.effectiveUntil.toISOString() } : {}) })),
      })),
      checkout_sessions: snapshot.checkoutSessions.map((session) => ({
        app_id: session.appId,
        user_ref: session.userRef,
        plan_key: session.planKey,
        provider_id: session.providerId,
        provider_account: session.providerAccount,
        environment: session.environment,
        provider_checkout_session_ref: session.providerCheckoutSessionRef,
        status: session.status,
        expires_at: session.expiresAt.toISOString(),
        created_at: session.createdAt.toISOString(),
      })),
      webhooks: snapshot.webhooks.map((webhook) => ({
        provider_id: webhook.providerId,
        provider_account: webhook.providerAccount,
        environment: webhook.environment,
        provider_event_id: webhook.providerEventId,
        event_type: webhook.eventType,
        app_id: webhook.appId,
        user_ref: webhook.userRef,
        status: webhook.status,
        attempt_count: webhook.attemptCount,
        received_at: webhook.receivedAt.toISOString(),
        processed_at: webhook.processedAt?.toISOString(),
        last_error_code: webhook.lastErrorCode,
      })),
      reconciliation_runs: snapshot.reconciliationRuns.map((run) => ({
        id: run.id,
        app_id: run.appId,
        user_ref: run.userRef,
        provider_id: run.providerId,
        provider_account: run.providerAccount,
        environment: run.environment,
        status: run.status,
        classification: run.classification,
        request_id: run.requestId,
        completed_at: run.completedAt.toISOString(),
      })),
    };
  }
  currentSubscription(appId: string, userRef: string): Promise<SubscriptionProjection> {
    return this.repository.currentSubscription(appId, userRef);
  }

  currentEntitlements(appId: string, userRef: string): Promise<EntitlementProjection> {
    return this.repository.currentEntitlements(appId, userRef);
  }
}

export class PaymentHubServiceError extends Error {
  constructor(readonly code: "PROVIDER_LOOKUP_KEY_NOT_CONFIGURED" | "PROVIDER_CUSTOMER_NOT_FOUND", message: string) {
    super(message);
    this.name = "PaymentHubServiceError";
  }
}

function sameSubscription(current: SubscriptionProjection, snapshot: { readonly state: SubscriptionProjection["state"]; readonly planKey?: string; readonly currentPeriodEnd?: Date }): boolean {
  return current.state === snapshot.state
    && current.planKey === snapshot.planKey
    && current.currentPeriodEnd?.getTime() === snapshot.currentPeriodEnd?.getTime();
}

function serializeSubscription(subscription: SubscriptionProjection): Record<string, unknown> {
  return {
    app_id: subscription.appId,
    user_ref: subscription.userRef,
    state: subscription.state,
    ...(subscription.planKey ? { plan_key: subscription.planKey } : {}),
    ...(subscription.currentPeriodEnd ? { current_period_end: subscription.currentPeriodEnd.toISOString() } : {}),
  };
}