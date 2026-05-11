import crypto from "crypto";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

// Derive a per-dapp API key using HMAC with a server-side root secret.
// Returns a URL-safe key string. The derivation includes random nonce so keys are unique per-creation.
export function deriveApiKey(dappId: string): string {
  if (!config.apiRootSecret) {
    throw new ApiError(500, "KEYS_MISCONFIGURED", "API_ROOT_SECRET not configured on server");
  }

  const nonce = crypto.randomBytes(8).toString("hex");
  const hmac = crypto.createHmac("sha256", config.apiRootSecret);
  hmac.update(`${dappId}:${nonce}:${Date.now()}`);
  const raw = hmac.digest();

  // Encode as base64url and prefix to indicate live key
  const key = `os_live_${raw.toString("base64url")}`;
  return key;
}

export function getPrefix(key: string, len = 8): string {
  return key.slice(0, len);
}

export function hashApiKeyForStore(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  try {
    const aa = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (aa.length !== bb.length) {
      return false;
    }
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export default {
  deriveApiKey,
  getPrefix,
  hashApiKeyForStore,
  constantTimeEquals,
};
