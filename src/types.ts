import { z } from "zod";

export const moveCallDescriptorSchema = z.object({
  package: z.string().min(3),
  module: z.string().min(1),
  function: z.string().min(1),
});

export const sponsorRequestSchema = z.object({
  transactionKind: z.string().min(8),
  sender: z.string().min(3),
  requestedCalls: z.array(moveCallDescriptorSchema).default([]),
  purchaseAmountMist: z.number().int().positive().optional(),
  recipient: z.string().min(3).max(128).optional(),
  maxGasBudget: z.number().int().positive().optional(),
  network: z.enum(["testnet", "mainnet"]).optional(),
  idempotencyKey: z.string().min(6).max(128).optional(),
});

export const quoteRequestSchema = sponsorRequestSchema;

export type MoveCallDescriptor = z.infer<typeof moveCallDescriptorSchema>;
export type SponsorRequest = z.infer<typeof sponsorRequestSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
