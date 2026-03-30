import { PrismaClient } from "@prisma/client";

import { config } from "./config.js";

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!config.databaseUrl) {
    return null;
  }

  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }

  return prismaSingleton;
}
