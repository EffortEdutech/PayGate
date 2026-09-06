import Stripe from "stripe";
import type {
  CheckoutResult,
  HubProviderEventType,
  NormalizedProviderEventPayload,
  PaymentProviderAdapter,
  PortalResult,
  ProviderSubscriptionSnapshot,
  ProviderCapabilities,
  ResolvedCheckoutCommand,
  ResolvedPortalCommand,
  ResolvedReconciliationCommand,
  VerifiedProviderEvent,
} from "@payment-hub/contracts";
import type { Environment, SubscriptionState } from "@payment-hub/types";

export class StripeAdapterNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  constructor() {
    super("Stripe runtime operations are not configured");
    this.name = "StripeAdapterNotConfiguredError";
  }
}

export class StripeAdapterSkeleton implements PaymentProviderAdapter {
  readonly providerId = "stripe";

  capabilities(): ProviderCapabilities {
    return {
      contractVersion: "1.0",
      providerId: this.providerId,
      hostedCheckout: { supported: true, modes: ["payment", "subscription"] },
      customerPortal: { supported: true },
      nativeSubscriptions: { supported: true, intervals: ["day", "week", "month", "year"], trials: true },
      refunds: { supported: true, partial: true },
      recurringMandates: { supported: true },
      webhookSignatures: { supported: true },
      reconciliation: { supported: true },
    };
  }

  async createCheckout(_command: ResolvedCheckoutCommand): Promise<CheckoutResult> { throw new StripeAdapterNotConfiguredError(); }
  async createPortalSession(_command: ResolvedPortalCommand): Promise<PortalResult> { throw new StripeAdapterNotConfiguredError(); }
  async verifyWebhook(_input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: Environment }): Promise<VerifiedProviderEvent> { throw new StripeAdapterNotConfiguredError(); }
  async reconcileCustomer(_command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> { throw new StripeAdapterNotConfiguredError(); }
}

export interface StripeAdapterBaseConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly apiVersion: string;
}

export interface StripeTestAdapterConfig extends StripeAdapterBaseConfig {
  readonly environment: "test";
}

export interface StripeLiveAdapterConfig extends StripeAdapterBaseConfig {
  readonly environment: "live";
}

export type StripeAdapterConfig = StripeTestAdapterConfig;

export class StripeLiveAdapterNotImplemented extends StripeAdapterSkeleton {
  constructor(config: StripeLiveAdapterConfig) {
    super();
    assertStripeKeyMode(config.secretKey, "live", "Live Stripe adapter");
  }
}

export class StripeSandboxAdapter implements PaymentProviderAdapter {
  readonly providerId = "stripe";
  readonly #stripe: Stripe;
  readonly #webhookSecret: string;

  constructor(config: StripeAdapterConfig) {
    if (!config.secretKey.startsWith("sk_test_")) throw new Error("Phase 2 Stripe adapter requires a sandbox secret key");
    this.#webhookSecret = config.webhookSecret;
    this.#stripe = new Stripe(config.secretKey, { apiVersion: config.apiVersion as Stripe.LatestApiVersion, typescript: true });
  }

  capabilities(): ProviderCapabilities { return new StripeAdapterSkeleton().capabilities(); }

  async createCheckout(command: ResolvedCheckoutCommand): Promise<CheckoutResult> {
    try {
      const prices = await this.#stripe.prices.list({ lookup_keys: [command.providerLookupKey], active: true, limit: 1 });
      const price = prices.data[0];
      if (!price) throw new StripeAdapterRuntimeError("PROVIDER_PRICE_NOT_FOUND", "Stripe Price lookup key was not found");
      const customer = await this.#stripe.customers.create({ metadata: customerMetadata(command) }, { idempotencyKey: `cph_customer:v2:${command.environment}:${command.providerAccount}:${command.appId}:${command.userRef}` });
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: command.mode,
        customer: customer.id,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: command.successUrl.href,
        cancel_url: command.cancelUrl.href,
        client_reference_id: `${command.appId}:${command.userRef}`,
        metadata: minimalMetadata(command),
      };
      if (command.mode === "subscription") sessionParams.subscription_data = { metadata: minimalMetadata(command) };
      const session = await this.#stripe.checkout.sessions.create(sessionParams, { idempotencyKey: `cph_checkout:${command.requestId}` });
      if (!session.url) throw new StripeAdapterRuntimeError("PROVIDER_SESSION_URL_MISSING", "Stripe did not return a checkout URL");
      return { checkoutSessionId: session.id, redirectUrl: new URL(session.url), status: "open", expiresAt: new Date((session.expires_at ?? Math.floor(Date.now() / 1000) + 1800) * 1000), providerCustomerRef: customer.id };
    } catch (error) {
      throw translateStripeError(error);
    }
  }

  async createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult> {
    try {
      const session = await this.#stripe.billingPortal.sessions.create({ customer: command.providerCustomerRef, return_url: command.returnUrl.href }, { idempotencyKey: `cph_portal:${command.requestId}` });
      return { portalSessionId: session.id, redirectUrl: new URL(session.url) };
    } catch (error) {
      throw translateStripeError(error);
    }
  }

  async reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> {
    try {
      const [customer, subscriptions, checkoutSessions, invoices] = await Promise.all([
        this.#stripe.customers.retrieve(command.providerCustomerRef),
        this.#stripe.subscriptions.list({ customer: command.providerCustomerRef, status: "all", limit: 3, expand: ["data.items.data.price", "data.latest_invoice"] }),
        this.#stripe.checkout.sessions.list({ customer: command.providerCustomerRef, limit: 3, expand: ["data.subscription", "data.payment_intent"] }),
        this.#stripe.invoices.list({ customer: command.providerCustomerRef, limit: 3, expand: ["data.payment_intent", "data.subscription"] }),
      ]);
      const subscription = preferredSubscription(subscriptions.data);
      const evidence = buildStripeReconciliationEvidence(command, customer, subscriptions.data, checkoutSessions.data, invoices.data);
      if (!subscription) return { providerId: this.providerId, providerAccount: command.providerAccount, environment: command.environment, providerCustomerRef: command.providerCustomerRef, providerSubscriptionRef: "none", observedAt: new Date(), state: "none", evidence };
      const item = subscription.items.data[0];
      const price = item?.price;
      const currentPeriodEnd = item?.current_period_end;
      return { providerId: this.providerId, providerAccount: command.providerAccount, environment: command.environment, providerCustomerRef: command.providerCustomerRef, providerSubscriptionRef: subscription.id, observedAt: new Date(), state: mapStripeSubscriptionState(subscription.status), ...(subscription.metadata.cph_plan_key ? { planKey: subscription.metadata.cph_plan_key } : price?.lookup_key ? { planKey: price.lookup_key } : {}), ...(currentPeriodEnd ? { currentPeriodEnd: new Date(currentPeriodEnd * 1000) } : {}), evidence };
    } catch (error) {
      throw translateStripeError(error);
    }
  }

  async verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: Environment }): Promise<VerifiedProviderEvent> {
    const event = this.#stripe.webhooks.constructEvent(Buffer.from(input.rawBody), input.signature, this.#webhookSecret);
    return normalizeStripeEvent(event, { providerAccount: input.account, environment: input.environment });
  }
}


export class StripeLiveWebhookAdapter implements PaymentProviderAdapter {
  readonly providerId = "stripe";
  readonly #stripe: Stripe;
  readonly #webhookSecret: string;

  constructor(config: StripeLiveAdapterConfig) {
    assertStripeKeyMode(config.secretKey, "live", "Live Stripe webhook adapter");
    this.#webhookSecret = config.webhookSecret;
    this.#stripe = new Stripe(config.secretKey, { apiVersion: config.apiVersion as Stripe.LatestApiVersion, typescript: true });
  }

  capabilities(): ProviderCapabilities { return new StripeAdapterSkeleton().capabilities(); }
  async createCheckout(_command: ResolvedCheckoutCommand): Promise<CheckoutResult> { throw new StripeAdapterNotConfiguredError(); }
  async createPortalSession(_command: ResolvedPortalCommand): Promise<PortalResult> { throw new StripeAdapterNotConfiguredError(); }
  async reconcileCustomer(_command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> { throw new StripeAdapterNotConfiguredError(); }

  async verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: Environment }): Promise<VerifiedProviderEvent> {
    if (input.environment !== "live") throw new StripeAdapterRuntimeError("PROVIDER_ENVIRONMENT_MISMATCH", "Live Stripe webhook adapter accepts only live webhook events");
    const event = this.#stripe.webhooks.constructEvent(Buffer.from(input.rawBody), input.signature, this.#webhookSecret);
    return normalizeStripeEvent(event, { providerAccount: input.account, environment: input.environment });
  }
}
function assertStripeKeyMode(secretKey: string, expected: "test" | "live", label: string): void {
  const prefix = expected === "test" ? "sk_test_" : "sk_live_";
  if (!secretKey.startsWith(prefix)) throw new Error(`${label} requires an ${expected === "test" ? "sandbox" : "live"} secret key`);
}
type StripeReconciliationMismatch =
  | "in_sync_candidate"
  | "no_provider_subscription"
  | "checkout_payment_mode_without_subscription"
  | "checkout_completed_subscription_missing"
  | "inactive_subscription_only"
  | "missing_plan_metadata"
  | "provider_customer_app_metadata_mismatch";

type StripeReconciliationEvidence = {
  readonly provider: "stripe";
  readonly classification: StripeReconciliationMismatch;
  readonly customer: Record<string, unknown>;
  readonly expected: {
    readonly app_id: string;
    readonly user_ref: string;
    readonly provider_account: string;
    readonly environment: Environment;
  };
  readonly subscriptions: readonly Record<string, unknown>[];
  readonly checkout_sessions: readonly Record<string, unknown>[];
  readonly invoices: readonly Record<string, unknown>[];
};

function preferredSubscription(subscriptions: readonly Stripe.Subscription[]): Stripe.Subscription | undefined {
  return subscriptions.find((subscription) => ["active", "trialing", "past_due", "paused"].includes(subscription.status)) ?? subscriptions[0];
}

function buildStripeReconciliationEvidence(command: ResolvedReconciliationCommand, customer: Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>, subscriptions: readonly Stripe.Subscription[], checkoutSessions: readonly Stripe.Checkout.Session[], invoices: readonly Stripe.Invoice[]): StripeReconciliationEvidence {
  const subscriptionSummaries = subscriptions.map(summarizeSubscription);
  const checkoutSummaries = checkoutSessions.map(summarizeCheckoutSession);
  const invoiceSummaries = invoices.map(summarizeInvoice);
  return {
    provider: "stripe",
    classification: classifyStripeReconciliationEvidence(command, subscriptionSummaries, checkoutSummaries),
    customer: summarizeCustomer(customer),
    expected: {
      app_id: command.appId,
      user_ref: command.userRef,
      provider_account: command.providerAccount,
      environment: command.environment,
    },
    subscriptions: subscriptionSummaries,
    checkout_sessions: checkoutSummaries,
    invoices: invoiceSummaries,
  };
}

export function classifyStripeReconciliationEvidence(command: Pick<ResolvedReconciliationCommand, "appId" | "userRef">, subscriptions: readonly Record<string, unknown>[], checkoutSessions: readonly Record<string, unknown>[]): StripeReconciliationMismatch {
  const metadataMismatch = [...subscriptions, ...checkoutSessions].some((record) => {
    const metadata = record.metadata as Record<string, unknown> | undefined;
    return metadata && ((typeof metadata.cph_app_id === "string" && metadata.cph_app_id !== command.appId) || (typeof metadata.cph_user_ref === "string" && metadata.cph_user_ref !== command.userRef));
  });
  if (metadataMismatch) return "provider_customer_app_metadata_mismatch";

  const activeLikeSubscription = subscriptions.find((record) => ["active", "trialing", "past_due", "paused"].includes(String(record.status)));
  if (activeLikeSubscription) {
    const metadata = activeLikeSubscription.metadata as Record<string, unknown> | undefined;
    const hasPlanMetadata = typeof metadata?.cph_plan_key === "string" || typeof activeLikeSubscription.price_lookup_key === "string";
    return hasPlanMetadata ? "in_sync_candidate" : "missing_plan_metadata";
  }

  if (subscriptions.length > 0) return "inactive_subscription_only";

  const completedCheckout = checkoutSessions.find((record) => record.status === "complete");
  if (completedCheckout?.mode === "payment") return "checkout_payment_mode_without_subscription";
  if (completedCheckout?.mode === "subscription") return "checkout_completed_subscription_missing";

  return "no_provider_subscription";
}

function summarizeCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): Record<string, unknown> {
  if (customer.deleted) return { id: customer.id, deleted: true };
  return {
    id: customer.id,
    deleted: false,
    email_present: Boolean(customer.email),
    metadata: allowedMetadata(customer.metadata),
  };
}
function summarizeSubscription(subscription: Stripe.Subscription): Record<string, unknown> {
  const item = subscription.items.data[0];
  const price = item?.price;
  return {
    id: subscription.id,
    status: subscription.status,
    current_period_end: item?.current_period_end ?? null,
    latest_invoice_id: providerRef(subscription.latest_invoice),
    metadata: allowedMetadata(subscription.metadata),
    price_id: price?.id ?? null,
    price_lookup_key: price?.lookup_key ?? null,
  };
}

function summarizeCheckoutSession(session: Stripe.Checkout.Session): Record<string, unknown> {
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    payment_status: session.payment_status,
    customer: providerRef(session.customer),
    subscription_id: providerRef(session.subscription),
    payment_intent_id: providerRef(session.payment_intent),
    client_reference_id: session.client_reference_id,
    metadata: allowedMetadata(session.metadata),
  };
}

function summarizeInvoice(invoice: Stripe.Invoice): Record<string, unknown> {
  const invoiceWithExpandableRefs = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null; payment_intent?: string | Stripe.PaymentIntent | null };
  return {
    id: invoice.id,
    status: invoice.status,
    customer: providerRef(invoice.customer),
    subscription_id: providerRef(invoiceWithExpandableRefs.subscription),
    payment_intent_id: providerRef(invoiceWithExpandableRefs.payment_intent),
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency?.toUpperCase(),
    metadata: allowedMetadata(invoice.metadata),
  };
}

function allowedMetadata(metadata: Stripe.Metadata | null | undefined): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of ["cph_app_id", "cph_user_ref", "cph_plan_key", "cph_environment", "cph_provider_account", "cph_request_id"]) {
    const value = metadata?.[key];
    if (typeof value === "string") safe[key] = value;
  }
  return safe;
}
export class StripeAdapterRuntimeError extends Error {
  constructor(readonly code: "PROVIDER_PRICE_NOT_FOUND" | "PROVIDER_SESSION_URL_MISSING" | "PROVIDER_AUTHENTICATION_FAILED" | "PROVIDER_RATE_LIMITED" | "PROVIDER_REQUEST_FAILED" | "PROVIDER_ENVIRONMENT_MISMATCH", message: string) {
    super(message);
    this.name = "StripeAdapterRuntimeError";
  }
}

export function normalizeStripeEvent(event: Stripe.Event, context: { readonly providerAccount: string; readonly environment: Environment }): VerifiedProviderEvent {
  const object = event.data.object as Stripe.Event.Data.Object & { metadata?: Stripe.Metadata; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null; subscription?: string | Stripe.Subscription | null; status?: unknown; current_period_end?: number | null; items?: { data?: Array<{ current_period_end?: number; price?: { lookup_key?: string | null } }> } };
  const metadata = object.metadata ?? {};
  const subscriptionState = subscriptionStateFromEvent(event.type, object);
  const periodEnd = currentPeriodEnd(object);
  const planKey = metadata.cph_plan_key ?? firstPriceLookupKey(object);
  const providerCustomerRef = providerRef(object.customer);
  const providerSubscriptionRef = providerRef(object.subscription) ?? objectId(object);
  const payload: NormalizedProviderEventPayload = {
    rawType: event.type,
    evidence: { id: objectId(object) ?? event.id, type: event.type, metadata },
    ...(metadata.cph_app_id ? { appId: metadata.cph_app_id } : {}),
    ...(metadata.cph_user_ref ? { userRef: metadata.cph_user_ref } : {}),
    ...(planKey ? { planKey } : {}),
    ...(providerCustomerRef ? { providerCustomerRef } : {}),
    ...(providerSubscriptionRef ? { providerSubscriptionRef } : {}),
    ...(subscriptionState ? { subscriptionState } : {}),
    ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
  };
  return {
    providerId: "stripe",
    providerAccount: context.providerAccount,
    environment: context.environment,
    providerEventId: event.id,
    providerCreatedAt: new Date(event.created * 1000),
    eventType: hubEventType(event.type, subscriptionState),
    payload,
  };
}
function minimalMetadata(command: ResolvedCheckoutCommand): Record<string, string> {
  return { ...customerMetadata(command), cph_plan_key: command.planKey, cph_request_id: command.requestId };
}

function customerMetadata(command: ResolvedCheckoutCommand): Record<string, string> {
  return { cph_app_id: command.appId, cph_user_ref: command.userRef, cph_environment: command.environment, cph_provider_account: command.providerAccount };
}

function mapStripeSubscriptionState(status: Stripe.Subscription.Status): SubscriptionState {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired") return "past_due";
  if (status === "paused") return "paused";
  if (status === "canceled") return "cancelled";
  return "active";
}

function subscriptionStateFromEvent(rawType: string, object: { status?: unknown }): SubscriptionState | undefined {
  if (rawType === "checkout.session.completed" || rawType === "invoice.payment_succeeded") return "active";
  if (rawType === "invoice.payment_failed") return "past_due";
  if (rawType === "customer.subscription.deleted") return "cancelled";
  if (typeof object.status === "string") return mapStripeSubscriptionState(object.status as Stripe.Subscription.Status);
  return undefined;
}

function hubEventType(rawType: string, state: SubscriptionState | undefined): HubProviderEventType {
  if (rawType === "checkout.session.completed") return "checkout.completed";
  if (rawType === "invoice.payment_succeeded") return "invoice.payment_succeeded";
  if (rawType === "invoice.payment_failed") return "invoice.payment_failed";
  if (rawType.startsWith("refund.")) return "refund.updated";
  if (rawType.startsWith("customer.subscription.")) {
    if (state === "trial") return "subscription.trial";
    if (state === "active") return "subscription.active";
    if (state === "past_due") return "subscription.past_due";
    if (state === "paused") return "subscription.paused";
    if (state === "cancelled") return "subscription.cancelled";
  }
  return "provider.event_ignored";
}

function providerRef(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return stringOrUndefined(value.id);
  return undefined;
}

function objectId(value: unknown): string | undefined {
  if (value && typeof value === "object" && "id" in value) return stringOrUndefined(value.id);
  return undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function currentPeriodEnd(object: { current_period_end?: number | null; items?: { data?: Array<{ current_period_end?: number }> } }): number | undefined {
  return object.current_period_end ?? object.items?.data?.[0]?.current_period_end;
}

function firstPriceLookupKey(object: { items?: { data?: Array<{ price?: { lookup_key?: string | null } }> } }): string | undefined {
  return object.items?.data?.[0]?.price?.lookup_key ?? undefined;
}

function translateStripeError(error: unknown): Error {
  if (error instanceof StripeAdapterRuntimeError) return error;
  if (error instanceof Stripe.errors.StripeAuthenticationError) return new StripeAdapterRuntimeError("PROVIDER_AUTHENTICATION_FAILED", "Stripe authentication failed");
  if (error instanceof Stripe.errors.StripeRateLimitError) return new StripeAdapterRuntimeError("PROVIDER_RATE_LIMITED", "Stripe rate limit exceeded");
  if (error instanceof Stripe.errors.StripeError) return new StripeAdapterRuntimeError("PROVIDER_REQUEST_FAILED", error.message);
  return error instanceof Error ? error : new Error(String(error));
}





