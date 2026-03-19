import { NextFunction, Request, Response } from "express";

import { config } from "./config.js";
import { ApiError } from "./errors.js";

interface Bucket {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, Bucket>();

function keyFor(req: Request): string {
  const ip = req.ip || "unknown";
  return `${req.apiKey ?? "anon"}:${ip}`;
}

export function dappRateLimit(req: Request, _res: Response, next: NextFunction) {
  const now = Date.now();
  const key = keyFor(req);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAtMs) {
    buckets.set(key, {
      count: 1,
      resetAtMs: now + config.rateLimitWindowMs,
    });
    return next();
  }

  if (bucket.count >= config.rateLimitMax) {
    return next(new ApiError(429, "RATE_LIMITED", "Rate limit exceeded"));
  }

  bucket.count += 1;
  return next();
}

interface QuotaRecord {
  day: string;
  spent: number;
}

const quotas = new Map<string, QuotaRecord>();

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function assertDailyBudget(dappName: string, gasBudget: number): void {
  const day = currentDay();
  const record = quotas.get(dappName);

  if (!record || record.day !== day) {
    quotas.set(dappName, { day, spent: gasBudget });
    return;
  }

  const next = record.spent + gasBudget;
  if (next > config.dappDailyBudgetMist) {
    throw new ApiError(402, "DAILY_BUDGET_EXCEEDED", "dApp daily budget exceeded");
  }

  record.spent = next;
}
