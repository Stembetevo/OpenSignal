import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { assertAllowlist, assertGasBudget } from "./policy.js";
import { assertDailyBudget } from "./rate-limit.js";
import { QuoteRequest, SponsorRequest } from "./types.js";

type SupportedNetwork = "testnet" | "mainnet";

function defaultRpcUrl(network: SupportedNetwork): string {
  return network === "mainnet"
    ? "https://fullnode.mainnet.sui.io:443"
    : "https://fullnode.testnet.sui.io:443";
}

function createKeypair(secret: string) {
  const parsed = decodeSuiPrivateKey(secret);
  switch (parsed.scheme) {
    case "ED25519":
      return Ed25519Keypair.fromSecretKey(secret);
    case "Secp256k1":
      return Secp256k1Keypair.fromSecretKey(secret);
    case "Secp256r1":
      return Secp256r1Keypair.fromSecretKey(secret);
    default:
      throw new Error(`Unsupported key scheme: ${parsed.scheme}`);
  }
}

interface PreparedTx {
  tx: Transaction;
  txBytes: Uint8Array;
  gasBudget: number;
  gasPrice: string;
  gasPayment: { objectId: string; version: string | number; digest: string };
  moveCalls: { package: string; module: string; function: string }[];
  dryRunStatus?: unknown;
}

export class SuiGasStationService {
  private readonly network: SupportedNetwork;
  private readonly client: SuiJsonRpcClient;
  private readonly keypair = createKeypair(config.sponsorPrivateKey);
  private readonly sponsorAddress = config.sponsorAddress || this.keypair.toSuiAddress();

  constructor(network?: SupportedNetwork) {
    this.network = network ?? config.network;
    this.client = new SuiJsonRpcClient({
      network: this.network,
      url: config.rpcUrl || defaultRpcUrl(this.network),
    });
  }

  validateApiKey(key: string): { valid: boolean; dappName?: string } {
    const dappName = config.apiKeys.get(key);
    return dappName ? { valid: true, dappName } : { valid: false };
  }

  async quote(payload: QuoteRequest): Promise<Record<string, unknown>> {
    const prepared = await this.prepare(payload, false);

    return {
      network: this.network,
      sponsorAddress: this.sponsorAddress,
      gasBudget: prepared.gasBudget,
      gasPrice: prepared.gasPrice,
      gasPayment: prepared.gasPayment,
      moveCalls: prepared.moveCalls,
      dryRunStatus: prepared.dryRunStatus ?? null,
    };
  }

  async sponsor(payload: SponsorRequest, dappName: string): Promise<Record<string, unknown>> {
    const prepared = await this.prepare(payload, true);
    assertDailyBudget(dappName, prepared.gasBudget);

    const signed = await this.keypair.signTransaction(prepared.txBytes);

    return {
      network: this.network,
      sponsorAddress: this.sponsorAddress,
      transactionBytes: signed.bytes,
      sponsorSignature: signed.signature,
      gasData: {
        owner: this.sponsorAddress,
        budget: prepared.gasBudget,
        price: prepared.gasPrice,
        payment: [prepared.gasPayment],
      },
      moveCalls: prepared.moveCalls,
      note: "Client must add user signature and submit dual-signed tx to a fullnode.",
    };
  }

  private async prepare(payload: QuoteRequest | SponsorRequest, enforceDryRunSuccess: boolean): Promise<PreparedTx> {
    const tx = Transaction.fromKind(payload.transactionKind);
    tx.setSender(payload.sender);
    tx.setGasOwner(this.sponsorAddress);

    const gasPayment = await this.pickGasCoin();
    tx.setGasPayment([gasPayment]);

    const gasBudget = assertGasBudget(payload.maxGasBudget);
    tx.setGasBudget(gasBudget);

    const gasPrice = await this.client.getReferenceGasPrice();
    tx.setGasPrice(gasPrice);

    const moveCalls = assertAllowlist(tx, payload.requestedCalls);
    const txBytes = await tx.build({ client: this.client });

    const dryRun = await this.client.dryRunTransactionBlock({
      transactionBlock: txBytes,
    });

    const dryRunStatus = dryRun.effects?.status;

    if (enforceDryRunSuccess && dryRunStatus?.status !== "success") {
      throw new ApiError(400, "DRY_RUN_FAILED", dryRunStatus?.error || "Dry run failed");
    }

    return {
      tx,
      txBytes,
      gasBudget,
      gasPrice: gasPrice.toString(),
      gasPayment,
      moveCalls,
      dryRunStatus,
    };
  }

  private async pickGasCoin(): Promise<{ objectId: string; version: string | number; digest: string }> {
    const coins = await this.client.getCoins({
      owner: this.sponsorAddress,
      coinType: "0x2::sui::SUI",
      limit: 50,
    });

    const selected = coins.data.find((coin) => BigInt(coin.balance) > BigInt(config.maxGasBudget));

    if (!selected) {
      throw new ApiError(500, "SPONSOR_LIQUIDITY_LOW", "No suitable sponsor gas coin found");
    }

    return {
      objectId: selected.coinObjectId,
      version: selected.version,
      digest: selected.digest,
    };
  }
}
