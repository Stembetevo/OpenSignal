import { NextFunction, Request, Response } from "express";

import { config } from "./config.js";
import { getPrismaClient } from "./db.js";
import { ApiError } from "./errors.js";
import { hashApiKey } from "./portal-auth.js";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      dappName?: string;
      apiKey?: string;
    }
  }
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  // Accept either `x-api-key` header or `Authorization: Bearer <key>`
  const headerKey = req.header("x-api-key")?.trim();
  const bearer = req.header("authorization")?.trim();
  const key = headerKey || (bearer && bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : undefined);

  if (!key) return next(new ApiError(401, "UNAUTHORIZED", "Missing API key"));

  // Fast path: check in-memory mapping first
  const mapped = config.apiKeys.get(key);
  if (mapped) {
    req.apiKey = key;
    req.dappName = mapped;
    return next();
  }

  const prisma = getPrismaClient();
  if (!prisma) return next(new ApiError(503, "PORTAL_DISABLED", "Database not configured"));

  // Look up by prefix then compare hash in constant time
  const prefix = key.slice(0, 8);
  const candidates = await prisma.apiKey.findMany({ where: { keyPrefix: prefix, status: "ACTIVE" }, include: { dapp: true } });
  if (!candidates || !candidates.length) return next(new ApiError(401, "UNAUTHORIZED", "Invalid API key"));

  const providedHash = hashApiKey(key);
  for (const c of candidates) {
    try {
      const a = Buffer.from(c.keyHash, "utf8");
      const b = Buffer.from(providedHash, "utf8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        req.apiKey = key;
        req.dappName = c.dapp.name;
        await prisma.apiKey.update({ where: { id: c.id }, data: { lastUsedAt: new Date() } });
        return next();
      }
    } catch {
      // fallthrough to next candidate
    }
  }

  return next(new ApiError(401, "UNAUTHORIZED", "Invalid API key"));
}
