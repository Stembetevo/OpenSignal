import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";

import { requireApiKey } from "./auth.js";
import { config } from "./config.js";
import { toApiError } from "./errors.js";
import { portalRouter } from "./portal.js";
import { dappRateLimit } from "./rate-limit.js";
import { SuiGasStationService } from "./sui.js";
import { quoteRequestSchema, sponsorRequestSchema } from "./types.js";
import { recordSponsorshipEvent } from "./usage-events.js";

const app = express();
const logger = pino({
  level: config.nodeEnv === "production" ? "info" : "debug",
});

const service = new SuiGasStationService();

app.set("trust proxy", config.trustProxy);
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl ? [config.frontendUrl] : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "512kb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        latencyMs: Date.now() - start,
      },
      "request",
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sui-gas-station",
    network: config.network,
    timestamp: new Date().toISOString(),
  });
});

app.post("/v1/auth/validate", requireApiKey, dappRateLimit, (req, res) => {
  res.json({
    ok: true,
    dapp: req.dappName,
  });
});

app.post("/v1/sponsor/quote", requireApiKey, dappRateLimit, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const payload = quoteRequestSchema.parse(req.body);
    const quote = await service.quote(payload);
    await recordSponsorshipEvent({
      dappName: req.dappName as string,
      endpoint: "/v1/sponsor/quote",
      status: "success",
      gasBudget: quote.gasBudget as number,
      latencyMs: Date.now() - startedAt,
    });
    res.json({ ok: true, quote });
  } catch (error) {
    await recordSponsorshipEvent({
      dappName: req.dappName as string,
      endpoint: "/v1/sponsor/quote",
      status: "failed",
      errorCode: toApiError(error).code,
      latencyMs: Date.now() - startedAt,
    });
    next(error);
  }
});

app.post("/v1/sponsor/sign", requireApiKey, dappRateLimit, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const payload = sponsorRequestSchema.parse(req.body);
    const result = await service.sponsor(payload, req.dappName as string);
    const gasData = (result as { gasData?: { budget?: number | string } }).gasData;
    await recordSponsorshipEvent({
      dappName: req.dappName as string,
      endpoint: "/v1/sponsor/sign",
      status: "success",
      gasBudget: gasData?.budget != null ? Number(gasData.budget) : undefined,
      latencyMs: Date.now() - startedAt,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    await recordSponsorshipEvent({
      dappName: req.dappName as string,
      endpoint: "/v1/sponsor/sign",
      status: "failed",
      errorCode: toApiError(error).code,
      latencyMs: Date.now() - startedAt,
    });
    next(error);
  }
});

app.use("/v1/portal", portalRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const apiError = toApiError(error);
  logger.error({ err: apiError }, apiError.message);
  res.status(apiError.status).json({
    ok: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  });
});

app.listen(config.port, "0.0.0.0", () => {
  logger.info({ port: config.port }, "Sui gas station API started");
});
