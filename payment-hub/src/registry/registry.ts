import type { Environment } from "@payment-hub/types";
import type { RegisteredApplication, RegisteredPlan } from "./types.js";

export class Registry {
  readonly #apps: ReadonlyMap<string, RegisteredApplication>;

  constructor(applications: readonly RegisteredApplication[]) {
    this.#apps = new Map(applications.map((app) => [app.appId, app]));
    if (this.#apps.size !== applications.length) throw new Error("Duplicate app_id in registry");
  }

  application(appId: string): RegisteredApplication {
    const app = this.#apps.get(appId);
    if (!app) throw new RegistryError("APP_NOT_FOUND", `Application ${appId} is not registered`);
    return app;
  }

  activePlan(appId: string, planKey: string): RegisteredPlan {
    const plan = this.application(appId).plans.get(planKey);
    if (!plan || plan.status !== "active") throw new RegistryError("PLAN_NOT_AVAILABLE", `Plan ${planKey} is not active`);
    return plan;
  }

  returnUrls(appId: string, environment: Environment, context: string): { success: URL; cancel: URL; portal: URL } {
    const app = this.application(appId);
    const paths = app.returnContexts[context];
    if (!paths) throw new RegistryError("RETURN_CONTEXT_NOT_ALLOWED", `Return context ${context} is not registered`);
    const origin = app.origins[environment];
    return {
      success: new URL(paths.successPath, origin),
      cancel: new URL(paths.cancelPath, origin),
      portal: new URL(paths.portalPath, origin),
    };
  }
}

export class RegistryError extends Error {
  constructor(readonly code: "APP_NOT_FOUND" | "PLAN_NOT_AVAILABLE" | "RETURN_CONTEXT_NOT_ALLOWED", message: string) {
    super(message);
    this.name = "RegistryError";
  }
}
