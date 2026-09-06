import type { EntitlementProjection, ProviderSubscriptionSnapshot, ReconciliationResult, SubscriptionProjection, VerifiedProviderEvent } from "@payment-hub/contracts";
import type { AdminDashboardSnapshot, MonitoringSnapshot, PaymentRepository, CheckoutSessionRecord, ReconciliationRunInput } from "./repository.js";

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly #applications = new Map<string, string>();
  readonly #providerCustomers = new Map<string, Parameters<PaymentRepository["saveProviderCustomer"]>[0]>();
  readonly #checkoutSessions = new Map<string, CheckoutSessionRecord>();
  readonly #webhooks = new Map<string, { readonly event: VerifiedProviderEvent; readonly status: string; readonly duplicate: boolean; readonly receivedAt: Date; readonly processedAt?: Date }>();
  readonly #subscriptions = new Map<string, SubscriptionProjection>();
  readonly #entitlements = new Map<string, EntitlementProjection>();
  readonly #reconciliationRuns = new Map<string, ReconciliationRunInput>();

  async ensureApplication(input: { readonly appId: string; readonly registryVersion: string; readonly status: string }): Promise<string> {
    const id = this.#applications.get(input.appId) ?? `app_${this.#applications.size + 1}`;
    this.#applications.set(input.appId, id);
    return id;
  }

  async findProviderCustomer(input: Parameters<PaymentRepository["findProviderCustomer"]>[0]): Promise<string | undefined> { return this.#providerCustomers.get(customerKey(input))?.providerCustomerRef; }
  async saveProviderCustomer(input: Parameters<PaymentRepository["saveProviderCustomer"]>[0]): Promise<void> { this.#providerCustomers.set(customerKey(input), input); }
  async saveCheckoutSession(record: CheckoutSessionRecord): Promise<void> { this.#checkoutSessions.set(record.checkoutSessionId, record); }

  async insertWebhookEvent(event: VerifiedProviderEvent, _payloadHash: string): Promise<"inserted" | "duplicate"> {
    const key = `${event.providerId}:${event.providerAccount}:${event.environment}:${event.providerEventId}`;
    if (this.#webhooks.has(key)) return "duplicate";
    this.#webhooks.set(key, { event, status: "pending", duplicate: false, receivedAt: new Date() });
    return "inserted";
  }

  async applyVerifiedEvent(event: VerifiedProviderEvent): Promise<void> {
    const payload = event.payload;
    if (!payload.appId || !payload.userRef) return;
    if (payload.providerCustomerRef) await this.saveProviderCustomer({ appId: payload.appId, userRef: payload.userRef, providerId: event.providerId, providerAccount: event.providerAccount, environment: event.environment, providerCustomerRef: payload.providerCustomerRef });
    const state = payload.subscriptionState ?? "active";
    this.#subscriptions.set(`${payload.appId}:${payload.userRef}`, { appId: payload.appId, userRef: payload.userRef, state, ...(payload.planKey ? { planKey: payload.planKey } : {}), ...(payload.currentPeriodEnd ? { currentPeriodEnd: payload.currentPeriodEnd } : {}) });
    if (payload.planKey) this.projectPlanEntitlement(payload.appId, payload.userRef, payload.planKey, state === "active" || state === "trial" ? "active" : "revoked", payload.currentPeriodEnd);
    const webhookKey = `${event.providerId}:${event.providerAccount}:${event.environment}:${event.providerEventId}`;
    const existing = this.#webhooks.get(webhookKey);
    if (existing) this.#webhooks.set(webhookKey, { ...existing, status: "processed", processedAt: new Date() });
  }

  async applyReconciliationSnapshot(input: { readonly appId: string; readonly userRef: string; readonly snapshot: ProviderSubscriptionSnapshot }): Promise<SubscriptionProjection> {
    const projection: SubscriptionProjection = { appId: input.appId, userRef: input.userRef, state: input.snapshot.state, ...(input.snapshot.planKey ? { planKey: input.snapshot.planKey } : {}), ...(input.snapshot.currentPeriodEnd ? { currentPeriodEnd: input.snapshot.currentPeriodEnd } : {}) };
    this.#subscriptions.set(`${input.appId}:${input.userRef}`, projection);
    if (input.snapshot.planKey) this.projectPlanEntitlement(input.appId, input.userRef, input.snapshot.planKey, input.snapshot.state === "active" || input.snapshot.state === "trial" ? "active" : "revoked", input.snapshot.currentPeriodEnd);
    return projection;
  }

  async recordReconciliationRun(input: ReconciliationRunInput): Promise<string> {
    const runId = `recon_${this.#reconciliationRuns.size + 1}`;
    this.#reconciliationRuns.set(runId, input);
    return runId;
  }

  async currentSubscription(appId: string, userRef: string): Promise<SubscriptionProjection> { return this.#subscriptions.get(`${appId}:${userRef}`) ?? { appId, userRef, state: "none" }; }
  async currentEntitlements(appId: string, userRef: string): Promise<EntitlementProjection> { return this.#entitlements.get(`${appId}:${userRef}`) ?? { appId, userRef, entitlements: [] }; }


  async adminDashboardSnapshot(input: { readonly appId?: string; readonly environment?: "test" | "live"; readonly limit?: number } = {}): Promise<AdminDashboardSnapshot> {
    const limit = input.limit ?? 50;
    const customers = [...this.#providerCustomers.values()]
      .filter((customer) => !input.appId || customer.appId === input.appId)
      .filter((customer) => !input.environment || customer.environment === input.environment)
      .slice(0, limit)
      .map((customer) => ({
        appId: customer.appId,
        userRef: customer.userRef,
        createdAt: new Date(),
        providerCustomers: [{
          providerId: customer.providerId,
          providerAccount: customer.providerAccount,
          environment: customer.environment,
          providerCustomerRef: customer.providerCustomerRef,
          createdAt: new Date(),
        }],
        ...(this.#subscriptions.get(`${customer.appId}:${customer.userRef}`) ? { subscription: this.#subscriptions.get(`${customer.appId}:${customer.userRef}`)! } : {}),
        entitlements: this.#entitlements.get(`${customer.appId}:${customer.userRef}`)?.entitlements ?? [],
      }));
    return {
      generatedAt: new Date(),
      customers,
      checkoutSessions: [...this.#checkoutSessions.values()]
        .filter((session) => !input.appId || session.appId === input.appId)
        .filter((session) => !input.environment || session.environment === input.environment)
        .slice(0, limit)
        .map((session) => ({ appId: session.appId, userRef: session.userRef, planKey: session.planKey, providerId: session.providerId, providerAccount: session.providerAccount, environment: session.environment, providerCheckoutSessionRef: session.checkoutSessionId, status: session.status, expiresAt: session.expiresAt, createdAt: new Date() })),
      webhooks: [...this.#webhooks.values()]
        .filter(({ event }) => !input.appId || event.payload.appId === input.appId)
        .filter(({ event }) => !input.environment || event.environment === input.environment)
        .slice(0, limit)
        .map(({ event, status, receivedAt, processedAt }) => ({ providerId: event.providerId, providerAccount: event.providerAccount, environment: event.environment, providerEventId: event.providerEventId, eventType: event.eventType, ...(event.payload.appId ? { appId: event.payload.appId } : {}), ...(event.payload.userRef ? { userRef: event.payload.userRef } : {}), status, attemptCount: 0, receivedAt, ...(processedAt ? { processedAt } : {}) })),
      reconciliationRuns: [...this.#reconciliationRuns.entries()]
        .filter(([, run]) => !input.appId || run.appId === input.appId)
        .filter(([, run]) => !input.environment || run.environment === input.environment)
        .slice(0, limit)
        .map(([id, run]) => ({ id, appId: run.appId, userRef: run.userRef, providerId: run.providerId, providerAccount: run.providerAccount, environment: run.environment, status: run.status, ...(reconciliationClassification(run.evidence) ? { classification: reconciliationClassification(run.evidence)! } : {}), requestId: run.requestId, completedAt: new Date() })),
    };
  }

  async monitoringSnapshot(input: { readonly appId?: string; readonly environment?: "test" | "live" } = {}): Promise<MonitoringSnapshot> {
    const webhooks = [...this.#webhooks.values()]
      .filter(({ event }) => !input.appId || event.payload.appId === input.appId)
      .filter(({ event }) => !input.environment || event.environment === input.environment);
    const runs = [...this.#reconciliationRuns.values()]
      .filter((run) => !input.appId || run.appId === input.appId)
      .filter((run) => !input.environment || run.environment === input.environment);
    return {
      generatedAt: new Date(),
      webhookInbox: {
        failed: webhooks.filter((webhook) => webhook.status === "failed").length,
        pending: webhooks.filter((webhook) => webhook.status === "pending").length,
        retryable: webhooks.filter((webhook) => webhook.status === "retryable").length,
        deadLetter: webhooks.filter((webhook) => webhook.status === "dead_letter").length,
        unprocessed: webhooks.filter((webhook) => webhook.status !== "processed").length,
      },
      reconciliation: {
        failed: runs.filter((run) => run.status === "failed").length,
        noProviderCustomer: runs.filter((run) => run.status === "no_provider_customer").length,
        noProviderSubscription: runs.filter((run) => run.status === "no_provider_subscription").length,
      },
      database: { reachable: true },
    };
  }
  private projectPlanEntitlement(appId: string, userRef: string, planKey: string, state: "active" | "revoked", effectiveUntil?: Date): void {
    this.#entitlements.set(`${appId}:${userRef}`, { appId, userRef, entitlements: [{ key: `plan:${planKey}`, state, ...(effectiveUntil ? { effectiveUntil } : {}) }] });
  }
}

function customerKey(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: string }): string {
  return `${input.appId}:${input.userRef}:${input.providerId}:${input.providerAccount}:${input.environment}`;
}

function reconciliationClassification(evidence: unknown): string | undefined {
  return evidence && typeof evidence === "object" && "classification" in evidence && typeof evidence.classification === "string" ? evidence.classification : undefined;
}