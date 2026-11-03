import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

type TxClient = Prisma.TransactionClient;

export async function ensureCashWallet(tenantId: string, tx: TxClient = prisma) {
  const existing = await tx.cashWallet.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return tx.cashWallet.create({
    data: { tenantId, balanceBdt: 0 },
  });
}

export async function getTxnType(code: string, tx: TxClient = prisma) {
  const type = await tx.walletTxnTypeLookup.findUnique({ where: { code } });
  if (!type || !type.isActive) {
    throw new Error(`Unknown wallet txn type: ${code}`);
  }
  return type;
}

export type RecordWalletInput = {
  tenantId: string;
  typeCode: string;
  amountBdt: number;
  note?: string | null;
  reference?: string | null;
  occurredAt?: Date;
  createdBy?: string | null;
  /** Allow drawer to go negative (needed for sale reverse/refund). */
  allowNegative?: boolean;
  /** Run inside an existing transaction when provided. */
  tx?: TxClient;
};

async function applyWalletTxn(input: RecordWalletInput, tx: TxClient) {
  const type = await getTxnType(input.typeCode, tx);
  const wallet = await ensureCashWallet(input.tenantId, tx);

  const current = Number(wallet.balanceBdt);
  const delta =
    type.direction === "credit" ? input.amountBdt : -input.amountBdt;
  const next = current + delta;

  if (type.direction === "debit" && next < 0 && !input.allowNegative) {
    throw new Error("Insufficient cash drawer balance");
  }

  const updated = await tx.cashWallet.update({
    where: { id: wallet.id },
    data: { balanceBdt: next },
  });

  const txn = await tx.cashTransaction.create({
    data: {
      tenantId: input.tenantId,
      walletId: wallet.id,
      typeId: type.id,
      amountBdt: input.amountBdt,
      balanceAfter: next,
      note: input.note ?? null,
      reference: input.reference ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      createdBy: input.createdBy ?? null,
    },
    include: { type: true },
  });

  return { wallet: updated, transaction: txn, type };
}

/** Atomically credit/debit the company cash drawer and append a ledger row. */
export async function recordWalletTxn(input: RecordWalletInput) {
  if (!(input.amountBdt > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  if (input.tx) {
    return applyWalletTxn(input, input.tx);
  }

  return prisma.$transaction(async (tx) => applyWalletTxn(input, tx));
}

/**
 * Rebuild every ledger row's balanceAfter so the chain matches wallet cash.
 * Call inside a transaction after editing a historical debit/credit amount.
 */
export async function rebuildLedgerBalanceAfter(
  tenantId: string,
  walletBalanceBdt: number,
  tx: TxClient,
) {
  const rows = await tx.cashTransaction.findMany({
    where: { tenantId },
    include: { type: true },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  let net = 0;
  for (const row of rows) {
    const amt = Number(row.amountBdt);
    net += row.type.direction === "credit" ? amt : -amt;
  }
  // Opening cash before the first ledger row.
  let running = Math.round((walletBalanceBdt - net) * 100) / 100;

  for (const row of rows) {
    const amt = Number(row.amountBdt);
    running =
      Math.round(
        (running + (row.type.direction === "credit" ? amt : -amt)) * 100,
      ) / 100;
    if (Number(row.balanceAfter) !== running) {
      await tx.cashTransaction.update({
        where: { id: row.id },
        data: { balanceAfter: running },
      });
    }
  }

  const final = Math.round(running * 100) / 100;
  const wallet = Math.round(walletBalanceBdt * 100) / 100;
  if (final !== wallet) {
    throw new Error("Ledger rebuild mismatch — wallet and ledger do not agree");
  }
}

export type EditManualDebitInput = {
  tenantId: string;
  cashTransactionId: string;
  /** Must stay a debit type (MATERIAL_BUY, UTILITY, SALARY, EXPENSE, …). */
  newAmountBdt: number;
  note?: string | null;
  typeCode?: string;
  occurredAt?: Date;
  updatedBy?: string | null;
  tx: TxClient;
};

/**
 * Edit a manual debit (supply / utility / salary). Adjusts wallet by the
 * amount delta and rebuilds the full ledger balanceAfter chain.
 * Automated sales are never passed through this helper.
 */
export async function editManualDebitTxn(input: EditManualDebitInput) {
  if (!(input.newAmountBdt > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  const txn = await input.tx.cashTransaction.findFirst({
    where: { id: input.cashTransactionId, tenantId: input.tenantId },
    include: { type: true },
  });
  if (!txn) {
    throw new Error("Cash transaction not found");
  }
  if (txn.type.direction !== "debit") {
    throw new Error("Only debit entries can be edited this way");
  }

  const nextType = input.typeCode
    ? await getTxnType(input.typeCode, input.tx)
    : txn.type;
  if (nextType.direction !== "debit") {
    throw new Error("Replacement type must remain a debit");
  }

  const oldAmount = Number(txn.amountBdt);
  const delta =
    Math.round((input.newAmountBdt - oldAmount) * 100) / 100; // + = more cash out

  const wallet = await ensureCashWallet(input.tenantId, input.tx);
  const nextBalance =
    Math.round((Number(wallet.balanceBdt) - delta) * 100) / 100;
  if (nextBalance < 0) {
    throw new Error("Insufficient cash drawer balance");
  }

  const updatedWallet = await input.tx.cashWallet.update({
    where: { id: wallet.id },
    data: { balanceBdt: nextBalance },
  });

  const updatedTxn = await input.tx.cashTransaction.update({
    where: { id: txn.id },
    data: {
      amountBdt: input.newAmountBdt,
      typeId: nextType.id,
      note: input.note === undefined ? undefined : input.note,
      occurredAt: input.occurredAt ?? undefined,
      updatedBy: input.updatedBy ?? null,
    },
    include: { type: true },
  });

  await rebuildLedgerBalanceAfter(input.tenantId, nextBalance, input.tx);

  return {
    wallet: updatedWallet,
    transaction: updatedTxn,
    walletDeltaBdt: delta,
  };
}

export function serializeTxn(txn: {
  id: string;
  tenantId: string;
  walletId: string;
  amountBdt: { toString(): string } | number | string;
  balanceAfter: { toString(): string } | number | string;
  note: string | null;
  reference: string | null;
  occurredAt: Date;
  createdAt: Date;
  type?: {
    code: string;
    nameEn: string;
    nameBn: string;
    direction: string;
  };
}) {
  return {
    id: txn.id,
    tenantId: txn.tenantId,
    walletId: txn.walletId,
    amountBdt: Number(txn.amountBdt),
    balanceAfter: Number(txn.balanceAfter),
    note: txn.note,
    reference: txn.reference,
    occurredAt: txn.occurredAt,
    createdAt: txn.createdAt,
    type: txn.type
      ? {
          code: txn.type.code,
          nameEn: txn.type.nameEn,
          nameBn: txn.type.nameBn,
          direction: txn.type.direction,
        }
      : null,
  };
}
