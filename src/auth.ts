import { NextFunction, Request, Response } from "express";

import { config } from "./config.js";
import { getPrismaClient } from "./db.js";
import { ApiError } from "./errors.js";
import { hashApiKey } from "./portal-auth.js";

declare global {
  namespace Express {
    interface Request {
      dappName?: string;
      apiKey?: string;
    }
  }
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-api-key")?.trim();

  if (!key) {
    return next(new ApiError(401, "UNAUTHORIZED", "Missing x-api-key header"));
  }

  const dappName = config.apiKeys.get(key);
  if (!dappName) {
    const prisma = getPrismaClient();
    if (!prisma) {
      return next(new ApiError(401, "UNAUTHORIZED", "Invalid API key"));
    }

    const dbKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      include: {
        dapp: true,
      },
    });

    if (!dbKey || dbKey.status !== "ACTIVE") {
      return next(new ApiError(401, "UNAUTHORIZED", "Invalid API key"));
    }

    req.apiKey = key;
    req.dappName = dbKey.dapp.name;
    await prisma.apiKey.update({
      where: { id: dbKey.id },
      data: { lastUsedAt: new Date() },
    });
    return next();
  }

  req.apiKey = key;
  req.dappName = dappName;
  return next();
}
