import "server-only";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export type CircleWallets = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

export function createCircleClient(opts: { apiKey: string; entitySecret: string }): CircleWallets {
  if (!opts.apiKey || !opts.entitySecret) throw new RangeError("Circle API key and entity secret are required");
  return initiateDeveloperControlledWalletsClient(opts);
}

// Carries status and code only. Response bodies are never logged.
export class CircleError extends Error {
  constructor(
    readonly operation: string,
    readonly statusCode: number | null,
    readonly errorCode: string | null,
    readonly outcomeUnknown: boolean,
  ) {
    super(`circle ${operation} failed${statusCode ? ` (HTTP ${statusCode})` : ""}${errorCode ? ` ${errorCode}` : ""}`);
    this.name = "CircleError";
  }
}

export function toCircleError(err: unknown, operation: string): CircleError {
  const e = err as { response?: { status?: number; data?: { code?: number | string } }; code?: string };
  const status = e?.response?.status ?? null;
  const code = e?.response?.data?.code != null ? String(e.response.data.code) : (e?.code ?? null);
  return new CircleError(operation, status, code, status === null || status >= 500);
}
