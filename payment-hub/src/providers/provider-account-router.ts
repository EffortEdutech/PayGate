import type {
  CheckoutResult,
  PaymentProviderAdapter,
  PortalResult,
  ProviderCapabilities,
  ProviderSubscriptionSnapshot,
  ResolvedCheckoutCommand,
  ResolvedPortalCommand,
  ResolvedReconciliationCommand,
  VerifiedProviderEvent,
} from "@payment-hub/contracts";
import type { Environment } from "@payment-hub/types";

export class ProviderAccountNotConfiguredError extends Error {
  readonly code = "PROVIDER_ACCOUNT_NOT_CONFIGURED";
  constructor(readonly providerId: string, readonly providerAccount: string) {
    super(`Provider account ${providerId}:${providerAccount} is not configured`);
    this.name = "ProviderAccountNotConfiguredError";
  }
}

export class ProviderAccountRouter implements PaymentProviderAdapter {
  readonly providerId: string;
  readonly #adapters: ReadonlyMap<string, PaymentProviderAdapter>;

  constructor(providerId: string, adapters: ReadonlyMap<string, PaymentProviderAdapter>) {
    this.providerId = providerId;
    this.#adapters = adapters;
  }

  capabilities(): ProviderCapabilities {
    const adapter = this.#adapters.values().next().value as PaymentProviderAdapter | undefined;
    if (!adapter) throw new ProviderAccountNotConfiguredError(this.providerId, "default");
    return adapter.capabilities();
  }

  createCheckout(command: ResolvedCheckoutCommand): Promise<CheckoutResult> {
    return this.adapter(command.providerAccount, command.environment).createCheckout(command);
  }

  createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult> {
    return this.adapter(command.providerAccount, command.environment).createPortalSession(command);
  }

  verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: Environment }): Promise<VerifiedProviderEvent> {
    return this.adapter(input.account, input.environment).verifyWebhook(input);
  }

  reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> {
    return this.adapter(command.providerAccount, command.environment).reconcileCustomer(command);
  }

  private adapter(account: string, environment?: Environment): PaymentProviderAdapter {
    const environmentScopedAdapter = environment ? this.#adapters.get(`${account}:${environment}`) : undefined;
    const adapter = environmentScopedAdapter ?? this.#adapters.get(account);
    if (!adapter) throw new ProviderAccountNotConfiguredError(this.providerId, account);
    return adapter;
  }
}