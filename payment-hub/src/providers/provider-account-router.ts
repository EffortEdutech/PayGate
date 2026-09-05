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
    return this.adapter(command.providerAccount).createCheckout(command);
  }

  createPortalSession(command: ResolvedPortalCommand): Promise<PortalResult> {
    return this.adapter(command.providerAccount).createPortalSession(command);
  }

  verifyWebhook(input: { readonly rawBody: Uint8Array; readonly signature: string; readonly account: string; readonly environment: Environment }): Promise<VerifiedProviderEvent> {
    return this.adapter(input.account).verifyWebhook(input);
  }

  reconcileCustomer(command: ResolvedReconciliationCommand): Promise<ProviderSubscriptionSnapshot> {
    return this.adapter(command.providerAccount).reconcileCustomer(command);
  }

  private adapter(account: string): PaymentProviderAdapter {
    const adapter = this.#adapters.get(account);
    if (!adapter) throw new ProviderAccountNotConfiguredError(this.providerId, account);
    return adapter;
  }
}