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
