import { z } from "zod";

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const createDappSchema = z.object({
  name: z.string().min(2).max(100),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  dailyBudgetMist: z.number().int().positive().optional(),
  allowlistMode: z.enum(["strict", "open"]).default("strict"),
});

export const updateDappSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  network: z.enum(["testnet", "mainnet"]).optional(),
  dailyBudgetMist: z.number().int().positive().optional(),
  allowlistMode: z.enum(["strict", "open"]).optional(),
});

export const createApiKeySchema = z.object({
  label: z.string().min(2).max(80).optional(),
});

export const usageSummaryQuerySchema = z.object({
  appId: z.string().min(1),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
