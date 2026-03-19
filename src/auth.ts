import { NextFunction, Request, Response } from "express";

import { config } from "./config.js";
import { ApiError } from "./errors.js";

declare global {
  namespace Express {
    interface Request {
      dappName?: string;
      apiKey?: string;
    }
  }
}

export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-api-key")?.trim();

  if (!key) {
    return next(new ApiError(401, "UNAUTHORIZED", "Missing x-api-key header"));
  }

  const dappName = config.apiKeys.get(key);
  if (!dappName) {
    return next(new ApiError(401, "UNAUTHORIZED", "Invalid API key"));
  }

  req.apiKey = key;
  req.dappName = dappName;
  return next();
}
