import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(10000),
  NODE_ENV: z.string().default("development"),
  SUI_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  SUI_RPC_URL: z.string().url().optional(),
  SPONSOR_PRIVATE_KEY: z.string().min(10),
  SPONSOR_ADDRESS: z.string().optional(),
  API_KEYS: z.string().min(3),
  ALLOWLIST: z.string().optional(),
  ALLOW_ALL_TRANSACTIONS: z.coerce.boolean().default(false),
  MAX_GAS_BUDGET: z.coerce.number().int().positive().default(20_000_000),
  DAPP_DAILY_BUDGET_MIST: z.coerce.number().int().positive().default(500_000_000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  TRUST_PROXY: z.coerce.boolean().default(false),
});

const env = envSchema.parse(process.env);

const apiKeys = new Map<string, string>();
for (const entry of env.API_KEYS.split(",")) {
  const [name, key] = entry.split(":").map((s) => s.trim());
  if (!name || !key) continue;
  apiKeys.set(key, name);
}

if (!apiKeys.size) {
  throw new Error("API_KEYS must include at least one dApp key pair");
}

const allowlist = new Set(
  (env.ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const allowAllTransactions = env.ALLOW_ALL_TRANSACTIONS || allowlist.has("*");

if (!allowAllTransactions && !allowlist.size) {
  throw new Error(
    "Set ALLOWLIST entries or set ALLOW_ALL_TRANSACTIONS=true to enable wildcard sponsorship",
  );
}

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  network: env.SUI_NETWORK,
  rpcUrl: env.SUI_RPC_URL,
  sponsorPrivateKey: env.SPONSOR_PRIVATE_KEY,
  sponsorAddress: env.SPONSOR_ADDRESS,
  apiKeys,
  allowlist,
  allowAllTransactions,
  maxGasBudget: env.MAX_GAS_BUDGET,
  dappDailyBudgetMist: env.DAPP_DAILY_BUDGET_MIST,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  trustProxy: env.TRUST_PROXY,
} as const;
