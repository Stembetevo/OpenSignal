import express from "express";
import { z } from "zod";

import { getPrismaClient } from "./db.js";
import { ApiError } from "./errors.js";
import { deriveApiKey, getPrefix, hashApiKeyForStore } from "./key-utils.js";
import { assertPortalAuthConfigured, verifyPortalToken } from "./portal-auth.js";
import { dappRateLimit } from "./rate-limit.js";

const router = express.Router();

const createSchema = z.object({ dappId: z.string().min(1), label: z.string().min(1).max(80).optional() });
const revokeSchema = z.object({ keyId: z.string().min(1) });

async function requirePortalJwt(req: express.Request, _res: express.Response, next: express.NextFunction) {
  try {
    assertPortalAuthConfigured();
    const auth = req.header("authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing portal bearer token");
    }
    const token = auth.slice(7).trim();
    verifyPortalToken(token);
    return next();
  } catch (e) {
    return next(e);
  }
}

// POST /api/keys
router.post("/", requirePortalJwt, dappRateLimit, async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);
    const prisma = getPrismaClient();
    if (!prisma) throw new ApiError(503, "DB_MISCONFIGURED", "Database not configured");

    const dapp = await prisma.dapp.findUnique({ where: { id: payload.dappId } });
    if (!dapp) throw new ApiError(404, "NOT_FOUND", "dApp not found");

    const rawKey = deriveApiKey(payload.dappId);
    const prefix = getPrefix(rawKey, 8);
    const keyHash = hashApiKeyForStore(rawKey);

    const created = await prisma.apiKey.create({
      data: {
        dappId: payload.dappId,
        label: payload.label,
        keyPrefix: prefix,
        keyHash,
      },
      select: {
        id: true,
        keyPrefix: true,
      },
    });

    // Return raw key once
    res.status(201).json({ ok: true, apiKey: rawKey, keyId: created.id, keyPrefix: created.keyPrefix });
  } catch (error) {
    next(error);
  }
});

// GET /api/keys?dappId=...
router.get("/", requirePortalJwt, dappRateLimit, async (req, res, next) => {
  try {
    const dappId = String(req.query.dappId || "");
    if (!dappId) throw new ApiError(400, "INVALID_INPUT", "dappId required");
    const prisma = getPrismaClient();
    if (!prisma) throw new ApiError(503, "DB_MISCONFIGURED", "Database not configured");

    const keys = await prisma.apiKey.findMany({
      where: { dappId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, keyPrefix: true, status: true, createdAt: true, revokedAt: true, lastUsedAt: true },
    });

    res.json({ ok: true, keys });
  } catch (error) {
    next(error);
  }
});

// POST /api/keys/revoke
router.post("/revoke", requirePortalJwt, dappRateLimit, async (req, res, next) => {
  try {
    const payload = revokeSchema.parse(req.body);
    const prisma = getPrismaClient();
    if (!prisma) throw new ApiError(503, "DB_MISCONFIGURED", "Database not configured");

    const key = await prisma.apiKey.findUnique({ where: { id: payload.keyId } });
    if (!key) throw new ApiError(404, "NOT_FOUND", "API key not found");

    await prisma.apiKey.update({ where: { id: key.id }, data: { status: "REVOKED", revokedAt: new Date() } });

    res.json({ ok: true, revoked: true });
  } catch (error) {
    next(error);
  }
});

export default router;
