export interface DependencyCheck {
  readonly name: string;
  check(): Promise<boolean>;
}

export function health(): { readonly status: "ok" } {
  return { status: "ok" };
}

export async function readiness(checks: readonly DependencyCheck[]): Promise<{
  readonly status: "ready" | "not_ready";
  readonly checks: Readonly<Record<string, boolean>>;
}> {
  const results = await Promise.all(checks.map(async (dependency) => [dependency.name, await dependency.check()] as const));
  const resolved = Object.fromEntries(results);
  return { status: Object.values(resolved).every(Boolean) ? "ready" : "not_ready", checks: resolved };
}
