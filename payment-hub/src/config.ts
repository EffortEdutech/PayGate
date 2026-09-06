export interface StripeProviderAccountConfig {
  readonly account: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
}

export interface SupabaseJwtAuthConfig {
  readonly appId: string;
  readonly jwtSecret: string | undefined;
  readonly jwksUrl: string | undefined;
  readonly issuer: string | undefined;
  readonly audience: string | undefined;
}

export interface HubConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly databaseUrl: string;
  readonly authIssuer: string;
  readonly authAudience: string;
  readonly appAuthTokens: Readonly<Record<string, string>>;
  readonly supabaseJwtAuth: SupabaseJwtAuthConfig | undefined;
  readonly stripeSecretKey: string | undefined;
  readonly stripeWebhookSecret: string | undefined;
  readonly stripeApiVersion: string;
  readonly stripeAccounts: readonly StripeProviderAccountConfig[];
  readonly stripeLiveAccounts: readonly StripeProviderAccountConfig[];
}

export const defaultLocalPort = 3017;
export const localPortRange = { min: 3010, max: 3019 } as const;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export function loadHubConfig(env: NodeJS.ProcessEnv): HubConfig {
  const rawPort = env.PORT ?? String(defaultLocalPort);
  const port = Number(rawPort);
  const isVercelRuntime = env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
  if (!isVercelRuntime && (!Number.isInteger(port) || port < localPortRange.min || port > localPortRange.max)) {
    throw new Error(`PORT must stay in the project localhost 301# family (${localPortRange.min}-${localPortRange.max})`);
  }
  const nodeEnv = env.NODE_ENV ?? "development";
  if (!(["development", "test", "production"] as const).includes(nodeEnv as HubConfig["nodeEnv"])) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const stripeSecretKey = optional(env, "STRIPE_SECRET_KEY");
  const stripeWebhookSecret = optional(env, "STRIPE_WEBHOOK_SECRET");
  return {
    nodeEnv: nodeEnv as HubConfig["nodeEnv"],
    port,
    databaseUrl: required(env, "DATABASE_URL"),
    authIssuer: required(env, "APP_AUTH_ISSUER"),
    authAudience: required(env, "APP_AUTH_AUDIENCE"),
    appAuthTokens: parseAppAuthTokens(env.APP_AUTH_TOKENS ?? ""),
    supabaseJwtAuth: parseSupabaseJwtAuth(env),
    stripeSecretKey,
    stripeWebhookSecret,
    stripeApiVersion: env.STRIPE_API_VERSION?.trim() || "2026-02-25.clover",
    stripeAccounts: parseStripeAccounts(env, stripeSecretKey, stripeWebhookSecret),
    stripeLiveAccounts: parseStripeLiveAccounts(env),
  };
}

export function parseAppAuthTokens(raw: string): Readonly<Record<string, string>> {
  if (!raw.trim()) return {};
  return Object.fromEntries(raw.split(",").map((entry) => {
    const [appId, token] = entry.split(":");
    if (!appId?.trim() || !token?.trim()) throw new Error("APP_AUTH_TOKENS must use app_id:token entries");
    return [appId.trim(), token.trim()];
  }));
}

function parseSupabaseJwtAuth(env: NodeJS.ProcessEnv): SupabaseJwtAuthConfig | undefined {
  const jwtSecret = optional(env, "SUPABASE_JWT_SECRET");
  const jwksUrl = optional(env, "SUPABASE_JWKS_URL");
  const appId = optional(env, "SUPABASE_JWT_APP_ID");
  if (!jwtSecret && !jwksUrl && !appId) return undefined;
  if (!appId || (!jwtSecret && !jwksUrl)) throw new Error("SUPABASE_JWT_APP_ID and either SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET must be configured together");
  return {
    appId,
    jwtSecret,
    jwksUrl,
    issuer: optional(env, "SUPABASE_JWT_ISSUER"),
    audience: optional(env, "SUPABASE_JWT_AUDIENCE"),
  };
}

export function envNameForProviderAccount(account: string, suffix: "SECRET_KEY" | "WEBHOOK_SECRET"): string {
  return `STRIPE_ACCOUNT_${normalizeProviderAccountEnvSegment(account)}_${suffix}`;
}

export function liveEnvNameForProviderAccount(account: string, suffix: "SECRET_KEY" | "WEBHOOK_SECRET"): string {
  return `STRIPE_LIVE_ACCOUNT_${normalizeProviderAccountEnvSegment(account)}_${suffix}`;
}

function parseStripeAccounts(env: NodeJS.ProcessEnv, legacySecretKey?: string, legacyWebhookSecret?: string): StripeProviderAccountConfig[] {
  const accountNames = new Set(splitAccountList(env.STRIPE_ACCOUNTS ?? env.STRIPE_PROVIDER_ACCOUNTS));
  if (legacySecretKey && legacyWebhookSecret) {
    accountNames.add("primary");
    accountNames.add("nhl_global_solution");
  }
  const accounts: StripeProviderAccountConfig[] = [];
  for (const account of [...accountNames].sort()) {
    const secretKey = optional(env, envNameForProviderAccount(account, "SECRET_KEY")) ?? (account === "primary" || account === "nhl_global_solution" ? legacySecretKey : undefined);
    const webhookSecret = optional(env, envNameForProviderAccount(account, "WEBHOOK_SECRET")) ?? (account === "primary" || account === "nhl_global_solution" ? legacyWebhookSecret : undefined);
    if (secretKey && webhookSecret) accounts.push({ account, secretKey, webhookSecret });
  }
  return accounts;
}

function parseStripeLiveAccounts(env: NodeJS.ProcessEnv): StripeProviderAccountConfig[] {
  const accounts: StripeProviderAccountConfig[] = [];
  for (const account of splitAccountList(env.STRIPE_LIVE_ACCOUNTS)) {
    if (account === "primary") continue;
    const secretKey = optional(env, liveEnvNameForProviderAccount(account, "SECRET_KEY"));
    const webhookSecret = optional(env, liveEnvNameForProviderAccount(account, "WEBHOOK_SECRET"));
    if (secretKey && webhookSecret) accounts.push({ account, secretKey, webhookSecret });
  }
  return accounts;
}

function splitAccountList(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map((account) => account.trim()).filter(Boolean))].sort();
}

function normalizeProviderAccountEnvSegment(account: string): string {
  return account.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}