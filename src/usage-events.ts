import { getPrismaClient } from "./db.js";

interface SponsorshipEventInput {
  dappName: string;
  endpoint: string;
  status: "success" | "failed";
  gasBudget?: number;
  purchaseAmountMist?: number;
  recipient?: string;
  errorCode?: string;
  latencyMs?: number;
}

export async function recordSponsorshipEvent(input: SponsorshipEventInput): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return;
  }

  const dapp = await prisma.dapp.findFirst({ where: { name: input.dappName } });
  if (!dapp) {
    return;
  }

  await prisma.sponsorshipEvent.create({
    data: {
      dappId: dapp.id,
      endpoint: input.endpoint,
      status: input.status,
      gasBudget: input.gasBudget,
      purchaseAmountMist: input.purchaseAmountMist,
      recipient: input.recipient,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    },
  });
}
