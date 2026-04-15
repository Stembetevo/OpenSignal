-- CreateEnum
CREATE TYPE "public"."ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dapp" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "dailyBudgetMist" INTEGER NOT NULL DEFAULT 500000000,
    "allowlistMode" TEXT NOT NULL DEFAULT 'strict',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "dappId" TEXT NOT NULL,
    "label" TEXT,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" "public"."ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SponsorshipEvent" (
    "id" TEXT NOT NULL,
    "dappId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "gasBudget" INTEGER,
    "purchaseAmountMist" INTEGER,
    "recipient" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorshipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Dapp_ownerId_name_key" ON "public"."Dapp"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "public"."ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_dappId_idx" ON "public"."ApiKey"("dappId");

-- CreateIndex
CREATE INDEX "SponsorshipEvent_dappId_createdAt_idx" ON "public"."SponsorshipEvent"("dappId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Dapp" ADD CONSTRAINT "Dapp_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_dappId_fkey" FOREIGN KEY ("dappId") REFERENCES "public"."Dapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SponsorshipEvent" ADD CONSTRAINT "SponsorshipEvent_dappId_fkey" FOREIGN KEY ("dappId") REFERENCES "public"."Dapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
