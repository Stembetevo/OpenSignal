import express from "express";

import { ApiError } from "./errors.js";
import { getPrismaClient } from "./db.js";
import {
  apiKeyPrefix,
  assertPortalAuthConfigured,
  comparePassword,
  generateApiKey,
  hashApiKey,
  hashPassword,
  issuePortalToken,
  verifyPortalToken,
} from "./portal-auth.js";
import {
  createApiKeySchema,
  createDappSchema,
  loginSchema,
  signupSchema,
  updateDappSchema,
  usageSummaryQuerySchema,
} from "./portal-types.js";

declare global {
  namespace Express {
    interface Request {
      portalUserId?: string;
      portalUserEmail?: string;
    }
  }
}

function requirePortalAuth(req: express.Request, _res: express.Response, next: express.NextFunction) {
  try {
    assertPortalAuthConfigured();
    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing Bearer token");
    }

    const token = authHeader.slice(7).trim();
    const claims = verifyPortalToken(token);
    req.portalUserId = claims.sub;
    req.portalUserEmail = claims.email;
    return next();
  } catch (error) {
    return next(error);
  }
}

export const portalRouter = express.Router();

function routeParam(req: express.Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

portalRouter.post("/auth/signup", async (req, res, next) => {
  try {
    assertPortalAuthConfigured();
    const payload = signupSchema.parse(req.body);
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new ApiError(409, "EMAIL_IN_USE", "An account already exists for this email");
    }

    const user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        passwordHash: await hashPassword(payload.password),
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    const token = issuePortalToken({ sub: user.id, email: user.email });
    res.status(201).json({ ok: true, token, user });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/auth/login", async (req, res, next) => {
  try {
    assertPortalAuthConfigured();
    const payload = loginSchema.parse(req.body);
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const isValid = await comparePassword(payload.password, user.passwordHash);
    if (!isValid) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const token = issuePortalToken({ sub: user.id, email: user.email });
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/me", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.portalUserId as string },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/apps", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const apps = await prisma.dapp.findMany({
      where: { ownerId: req.portalUserId as string },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            apiKeys: true,
            sponsorshipEvents: true,
          },
        },
      },
    });

    res.json({ ok: true, apps });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/apps", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const payload = createDappSchema.parse(req.body);
    const app = await prisma.dapp.create({
      data: {
        ownerId: req.portalUserId as string,
        name: payload.name,
        network: payload.network,
        dailyBudgetMist: payload.dailyBudgetMist,
        allowlistMode: payload.allowlistMode,
      },
    });

    res.status(201).json({ ok: true, app });
  } catch (error) {
    next(error);
  }
});

portalRouter.patch("/apps/:appId", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const payload = updateDappSchema.parse(req.body);
    const app = await prisma.dapp.findFirst({
      where: {
        id: routeParam(req, "appId"),
        ownerId: req.portalUserId as string,
      },
    });

    if (!app) {
      throw new ApiError(404, "NOT_FOUND", "App not found");
    }

    const updated = await prisma.dapp.update({
      where: { id: app.id },
      data: payload,
    });

    res.json({ ok: true, app: updated });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/apps/:appId/api-keys", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const app = await prisma.dapp.findFirst({
      where: {
        id: routeParam(req, "appId"),
        ownerId: req.portalUserId as string,
      },
    });

    if (!app) {
      throw new ApiError(404, "NOT_FOUND", "App not found");
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { dappId: app.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });

    res.json({ ok: true, apiKeys });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/apps/:appId/api-keys", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const payload = createApiKeySchema.parse(req.body);
    const app = await prisma.dapp.findFirst({
      where: {
        id: routeParam(req, "appId"),
        ownerId: req.portalUserId as string,
      },
    });

    if (!app) {
      throw new ApiError(404, "NOT_FOUND", "App not found");
    }

    const plainApiKey = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        dappId: app.id,
        label: payload.label,
        keyPrefix: apiKeyPrefix(plainApiKey),
        keyHash: hashApiKey(plainApiKey),
      },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      ok: true,
      apiKey,
      secret: plainApiKey,
      note: "Store this secret now; it will not be shown again.",
    });
  } catch (error) {
    next(error);
  }
});

portalRouter.post("/api-keys/:keyId/revoke", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: routeParam(req, "keyId"),
        dapp: {
          ownerId: req.portalUserId as string,
        },
      },
    });

    if (!apiKey) {
      throw new ApiError(404, "NOT_FOUND", "API key not found");
    }

    const revoked = await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        revokedAt: true,
      },
    });

    res.json({ ok: true, apiKey: revoked });
  } catch (error) {
    next(error);
  }
});

portalRouter.get("/usage/summary", requirePortalAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new ApiError(503, "PORTAL_DISABLED", "Database is not configured");
    }

    const query = usageSummaryQuerySchema.parse(req.query);
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const app = await prisma.dapp.findFirst({
      where: {
        id: query.appId,
        ownerId: req.portalUserId as string,
      },
    });

    if (!app) {
      throw new ApiError(404, "NOT_FOUND", "App not found");
    }

    const [totalRequests, successRequests, failedRequests, gasAggregate, byEndpoint] = await Promise.all([
      prisma.sponsorshipEvent.count({
        where: {
          dappId: app.id,
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.sponsorshipEvent.count({
        where: {
          dappId: app.id,
          status: "success",
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.sponsorshipEvent.count({
        where: {
          dappId: app.id,
          status: "failed",
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.sponsorshipEvent.aggregate({
        where: {
          dappId: app.id,
          createdAt: { gte: from, lte: to },
        },
        _sum: {
          gasBudget: true,
        },
      }),
      prisma.sponsorshipEvent.groupBy({
        by: ["endpoint"],
        where: {
          dappId: app.id,
          createdAt: { gte: from, lte: to },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    res.json({
      ok: true,
      summary: {
        appId: app.id,
        appName: app.name,
        totalRequests,
        successRequests,
        failedRequests,
        totalGasBudget: gasAggregate._sum.gasBudget ?? 0,
        byEndpoint: byEndpoint.map((item) => ({ endpoint: item.endpoint, requests: item._count._all })),
      },
    });
  } catch (error) {
    next(error);
  }
});
