import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { MoveCallDescriptor } from "./types.js";

export function assertGasBudget(maxGasBudget?: number): number {
  if (maxGasBudget == null) {
    return config.maxGasBudget;
  }

  if (maxGasBudget > config.maxGasBudget) {
    throw new ApiError(400, "GAS_BUDGET_TOO_HIGH", `Requested gas budget exceeds max (${config.maxGasBudget})`);
  }

  return maxGasBudget;
}

export function extractMoveCalls(tx: Transaction): MoveCallDescriptor[] {
  const snapshot = tx.getData();
  const calls: MoveCallDescriptor[] = [];

  for (const command of snapshot.commands) {
    if (!("MoveCall" in command)) {
      continue;
    }

    const moveCall = command.MoveCall;
    if (!moveCall) {
      continue;
    }

    calls.push({
      package: moveCall.package,
      module: moveCall.module,
      function: moveCall.function,
    });
  }

  return calls;
}

export function assertAllowlist(tx: Transaction, requestedCalls: MoveCallDescriptor[]): MoveCallDescriptor[] {
  const actualCalls = extractMoveCalls(tx);

  if (!actualCalls.length) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Transaction has no MoveCall commands");
  }

  if (config.allowAllTransactions) {
    return actualCalls;
  }

  for (const call of actualCalls) {
    const key = `${call.package}::${call.module}::${call.function}`;
    if (!config.allowlist.has(key)) {
      throw new ApiError(403, "POLICY_DENIED", `Call not allowlisted: ${key}`);
    }
  }

  if (requestedCalls.length > 0) {
    const actual = new Set(actualCalls.map((c) => `${c.package}::${c.module}::${c.function}`));
    for (const requested of requestedCalls) {
      const expected = `${requested.package}::${requested.module}::${requested.function}`;
      if (!actual.has(expected)) {
        throw new ApiError(400, "REQUEST_MISMATCH", `requestedCalls entry not present in transaction: ${expected}`);
      }
    }
  }

  return actualCalls;
}
