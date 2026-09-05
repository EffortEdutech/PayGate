import type { QueryResult, QueryResultRow } from "pg";
import type { EntitlementState, Environment, SubscriptionState } from "@payment-hub/types";
import type { EntitlementProjection, ProviderSubscriptionSnapshot, SubscriptionProjection, VerifiedProviderEvent } from "@payment-hub/contracts";
import type { CheckoutSessionRecord, PaymentRepository, ReconciliationRunInput } from "./repository.js";

export interface PgQueryClient {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export interface PgTransactionalClient extends PgQueryClient {
  connect(): Promise<PgTransactionClient>;
}

export interface PgTransactionClient extends PgQueryClient {
  release(): void;
}

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(readonly db: PgQueryClient | PgTransactionalClient) {}

  async ensureApplication(input: { readonly appId: string; readonly registryVersion: string; readonly status: string }): Promise<string> {
    return this.ensureApplicationWithClient(this.db, input);
  }

  async findProviderCustomer(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: Environment }): Promise<string | undefined> {
    const result = await this.db.query<{ provider_customer_ref: string }>(
      `SELECT pc.provider_customer_ref
       FROM provider_customers pc
       JOIN payment_customers c ON c.id = pc.payment_customer_id
       JOIN payment_applications a ON a.id = c.application_id
       WHERE a.app_id = $1 AND c.app_user_ref = $2 AND pc.provider_id = $3 AND pc.provider_account = $4 AND pc.environment = $5`,
      [input.appId, input.userRef, input.providerId, input.providerAccount, input.environment],
    );
    return result.rows[0]?.provider_customer_ref;
  }

  async saveProviderCustomer(input: { readonly appId: string; readonly userRef: string; readonly providerId: string; readonly providerAccount: string; readonly environment: Environment; readonly providerCustomerRef: string }): Promise<void> {
    const paymentCustomerId = await this.ensurePaymentCustomer(input.appId, input.userRef);
    await this.upsertProviderCustomer(this.db, paymentCustomerId, input.providerId, input.providerAccount, input.environment, input.providerCustomerRef);
  }

  async saveCheckoutSession(record: CheckoutSessionRecord): Promise<void> {
    const applicationId = await this.ensureApplication({ appId: record.appId, registryVersion: "runtime", status: "active" });
    const paymentCustomerId = await this.ensurePaymentCustomer(record.appId, record.userRef);
    await this.db.query(
      `INSERT INTO checkout_sessions (application_id, payment_customer_id, provider_id, provider_account, environment, plan_key, provider_checkout_session_ref, redirect_url, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (provider_id, provider_account, environment, provider_checkout_session_ref)
       DO UPDATE SET redirect_url = EXCLUDED.redirect_url, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at`,
      [applicationId, paymentCustomerId, record.providerId, record.providerAccount, record.environment, record.planKey, record.checkoutSessionId, record.redirectUrl.href, record.status, record.expiresAt],
    );
  }

  async insertWebhookEvent(event: VerifiedProviderEvent, payloadHash: string): Promise<"inserted" | "duplicate"> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO webhook_inbox (provider_id, provider_account, environment, provider_event_id, provider_created_at, payload, payload_sha256)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (provider_id, provider_account, environment, provider_event_id) DO NOTHING
       RETURNING id`,
      [event.providerId, event.providerAccount, event.environment, event.providerEventId, event.providerCreatedAt, JSON.stringify(event.payload), payloadHash],
    );
    return result.rowCount === 0 ? "duplicate" : "inserted";
  }

  async applyVerifiedEvent(event: VerifiedProviderEvent): Promise<void> {
    return this.withOptionalTransaction((client) => this.applyVerifiedEventWithClient(client, event));
  }

  async applyReconciliationSnapshot(input: { readonly appId: string; readonly userRef: string; readonly snapshot: ProviderSubscriptionSnapshot }): Promise<SubscriptionProjection> {
    return this.withOptionalTransaction((client) => this.applyReconciliationSnapshotWithClient(client, input));
  }

  async recordReconciliationRun(input: ReconciliationRunInput): Promise<string> {
    const applicationId = await this.ensureApplication({ appId: input.appId, registryVersion: "runtime", status: "active" });
    const paymentCustomerId = await this.findPaymentCustomerId(input.appId, input.userRef);
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO reconciliation_runs (application_id, payment_customer_id, provider_id, provider_account, environment, status, evidence, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id`,
      [applicationId, paymentCustomerId, input.providerId, input.providerAccount, input.environment, input.status, JSON.stringify(input.evidence), input.requestId],
    );
    return requireRow(result, "reconciliation_runs").id;
  }

  async currentSubscription(appId: string, userRef: string): Promise<SubscriptionProjection> {
    const result = await this.db.query<{ state: SubscriptionState; plan_key: string | null; current_period_end: Date | null }>(
      `SELECT sp.state, sp.plan_key, sp.current_period_end
       FROM subscription_projection sp
       JOIN payment_customers c ON c.id = sp.payment_customer_id
       JOIN payment_applications a ON a.id = c.application_id
       WHERE a.app_id = $1 AND c.app_user_ref = $2
       ORDER BY sp.updated_at DESC
       LIMIT 1`,
      [appId, userRef],
    );
    const row = result.rows[0];
    if (!row) return { appId, userRef, state: "none" };
    return { appId, userRef, state: row.state, ...(row.plan_key ? { planKey: row.plan_key } : {}), ...(row.current_period_end ? { currentPeriodEnd: row.current_period_end } : {}) };
  }

  async currentEntitlements(appId: string, userRef: string): Promise<EntitlementProjection> {
    const result = await this.db.query<{ entitlement_key: string; status: EntitlementState; effective_until: Date | null }>(
      `SELECT DISTINCT ON (eg.entitlement_key) eg.entitlement_key, eg.status, eg.effective_until
       FROM entitlement_grants eg
       JOIN payment_customers c ON c.id = eg.payment_customer_id
       JOIN payment_applications a ON a.id = c.application_id
       WHERE a.app_id = $1 AND c.app_user_ref = $2
       ORDER BY eg.entitlement_key, eg.effective_from DESC`,
      [appId, userRef],
    );
    return { appId, userRef, entitlements: result.rows.map((row) => ({ key: row.entitlement_key, state: row.status, ...(row.effective_until ? { effectiveUntil: row.effective_until } : {}) })) };
  }

  private async applyVerifiedEventWithClient(client: PgQueryClient, event: VerifiedProviderEvent): Promise<void> {
    const payload = event.payload;
    if (!payload.appId || !payload.userRef) return;
    const paymentCustomerId = await this.ensurePaymentCustomerWithClient(client, payload.appId, payload.userRef);
    if (payload.providerCustomerRef) await this.upsertProviderCustomer(client, paymentCustomerId, event.providerId, event.providerAccount, event.environment, payload.providerCustomerRef);
    const subscriptionState = payload.subscriptionState ?? subscriptionStateForEvent(event.eventType);
    await this.upsertSubscriptionProjection(client, paymentCustomerId, subscriptionState, payload.planKey, payload.currentPeriodEnd, event.providerId, event.providerAccount, event.environment, payload.providerSubscriptionRef ?? event.providerEventId);
    if (payload.planKey) await this.insertEntitlementGrant(client, paymentCustomerId, payload.planKey, grantStatus(subscriptionState), "provider_event", event.providerEventId, event.providerCreatedAt, payload.currentPeriodEnd);
    await client.query(
      `UPDATE webhook_inbox SET status = 'processed', processed_at = now()
       WHERE provider_id = $1 AND provider_account = $2 AND environment = $3 AND provider_event_id = $4`,
      [event.providerId, event.providerAccount, event.environment, event.providerEventId],
    );
  }

  private async applyReconciliationSnapshotWithClient(client: PgQueryClient, input: { readonly appId: string; readonly userRef: string; readonly snapshot: ProviderSubscriptionSnapshot }): Promise<SubscriptionProjection> {
    const paymentCustomerId = await this.ensurePaymentCustomerWithClient(client, input.appId, input.userRef);
    await this.upsertProviderCustomer(client, paymentCustomerId, input.snapshot.providerId, input.snapshot.providerAccount, input.snapshot.environment, input.snapshot.providerCustomerRef);
    await this.upsertSubscriptionProjection(client, paymentCustomerId, input.snapshot.state, input.snapshot.planKey, input.snapshot.currentPeriodEnd, input.snapshot.providerId, input.snapshot.providerAccount, input.snapshot.environment, input.snapshot.providerSubscriptionRef);
    if (input.snapshot.planKey) await this.insertEntitlementGrant(client, paymentCustomerId, input.snapshot.planKey, grantStatus(input.snapshot.state), "reconciliation", input.snapshot.providerSubscriptionRef, input.snapshot.observedAt, input.snapshot.currentPeriodEnd);
    return { appId: input.appId, userRef: input.userRef, state: input.snapshot.state, ...(input.snapshot.planKey ? { planKey: input.snapshot.planKey } : {}), ...(input.snapshot.currentPeriodEnd ? { currentPeriodEnd: input.snapshot.currentPeriodEnd } : {}) };
  }

  private async upsertProviderCustomer(client: PgQueryClient, paymentCustomerId: string, providerId: string, providerAccount: string, environment: Environment, providerCustomerRef: string): Promise<void> {
    await client.query(
      `INSERT INTO provider_customers (payment_customer_id, provider_id, provider_account, environment, provider_customer_ref)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (payment_customer_id, provider_id, provider_account, environment)
       DO UPDATE SET provider_customer_ref = EXCLUDED.provider_customer_ref`,
      [paymentCustomerId, providerId, providerAccount, environment, providerCustomerRef],
    );
  }

  private async upsertSubscriptionProjection(client: PgQueryClient, paymentCustomerId: string, state: SubscriptionState | "none", planKey: string | undefined, currentPeriodEnd: Date | undefined, providerId: string, providerAccount: string, environment: Environment, sourceReference: string): Promise<void> {
    await client.query(
      `INSERT INTO subscription_projection (payment_customer_id, state, plan_key, current_period_end, source_provider_id, source_provider_account, source_environment, source_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (payment_customer_id, source_provider_id, source_provider_account, source_environment)
       DO UPDATE SET state = EXCLUDED.state, plan_key = EXCLUDED.plan_key, current_period_end = EXCLUDED.current_period_end, source_reference = EXCLUDED.source_reference, updated_at = now()`,
      [paymentCustomerId, state, planKey, currentPeriodEnd, providerId, providerAccount, environment, sourceReference],
    );
  }

  private async insertEntitlementGrant(client: PgQueryClient, paymentCustomerId: string, planKey: string, status: EntitlementState, sourceType: string, sourceReference: string, effectiveFrom: Date, effectiveUntil?: Date): Promise<void> {
    await client.query(
      `INSERT INTO entitlement_grants (payment_customer_id, entitlement_key, status, source_type, source_reference, effective_from, effective_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [paymentCustomerId, `plan:${planKey}`, status, sourceType, sourceReference, effectiveFrom, effectiveUntil],
    );
  }

  private async findPaymentCustomerId(appId: string, userRef: string): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `SELECT c.id
       FROM payment_customers c
       JOIN payment_applications a ON a.id = c.application_id
       WHERE a.app_id = $1 AND c.app_user_ref = $2`,
      [appId, userRef],
    );
    return result.rows[0]?.id ?? null;
  }

  private async ensurePaymentCustomer(appId: string, userRef: string): Promise<string> { return this.ensurePaymentCustomerWithClient(this.db, appId, userRef); }

  private async ensurePaymentCustomerWithClient(client: PgQueryClient, appId: string, userRef: string): Promise<string> {
    const applicationId = await this.ensureApplicationWithClient(client, { appId, registryVersion: "runtime", status: "active" });
    const result = await client.query<{ id: string }>(
      `INSERT INTO payment_customers (application_id, app_user_ref)
       VALUES ($1, $2)
       ON CONFLICT (application_id, app_user_ref) DO UPDATE SET app_user_ref = EXCLUDED.app_user_ref
       RETURNING id`,
      [applicationId, userRef],
    );
    return requireRow(result, "payment_customers").id;
  }

  private async ensureApplicationWithClient(client: PgQueryClient, input: { readonly appId: string; readonly registryVersion: string; readonly status: string }): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO payment_applications (app_id, registry_version, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (app_id) DO UPDATE SET registry_version = EXCLUDED.registry_version, status = EXCLUDED.status, updated_at = now()
       RETURNING id`,
      [input.appId, input.registryVersion, input.status],
    );
    return requireRow(result, "payment_applications").id;
  }

  private async withOptionalTransaction<T>(work: (client: PgQueryClient) => Promise<T>): Promise<T> {
    if (isTransactionalClient(this.db)) return this.withTransaction(work);
    return work(this.db);
  }

  private async withTransaction<T>(work: (client: PgTransactionClient) => Promise<T>): Promise<T> {
    if (!isTransactionalClient(this.db)) throw new Error("Transactional client is not available");
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function requireRow<R extends QueryResultRow>(result: QueryResult<R>, table: string): R {
  const row = result.rows[0];
  if (!row) throw new Error(`${table} did not return a row`);
  return row;
}

function subscriptionStateForEvent(eventType: string): SubscriptionState {
  if (eventType === "subscription.cancelled") return "cancelled";
  if (eventType === "subscription.past_due" || eventType === "invoice.payment_failed") return "past_due";
  if (eventType === "subscription.paused") return "paused";
  if (eventType === "subscription.trial") return "trial";
  return "active";
}

function grantStatus(state: SubscriptionState | "none"): EntitlementState {
  return state === "active" || state === "trial" ? "active" : "revoked";
}

function isTransactionalClient(client: PgQueryClient | PgTransactionalClient): client is PgTransactionalClient {
  return "connect" in client && typeof client.connect === "function";
}
