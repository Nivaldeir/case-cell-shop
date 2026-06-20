import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountBalanceHistoryRepository,
	IBalanceRepository,
	ILedgerEntryRepository,
	ILedgerTransactionRepository,
	IWalletRepository,
} from "@ledger/shared";
import {
	BalanceNotFound,
	Balances,
	Wallet,
	WalletNotFoundError,
} from "@ledger/shared";
import { CreditWalletBalance } from "@/application/usecase/Wallet/balances/CreditWalletBalance";

function makeWallet(
	overrides: Partial<{
		id: string;
		merchantId: string;
		accPixIn: string | null;
		accPixOut: string | null;
	}> = {},
) {
	return Wallet.restore({
		id: "wal_001",
		merchantId: "merch_001",
		accPixIn: "acc_001",
		...overrides,
	});
}

function makeBalance(
	available = 0,
	overrides: Partial<{
		accountId: string;
		walletId: string;
	}> = {},
) {
	return Balances.restore({
		id: "bal_001",
		walletId: "wal_001",
		assetCode: "BRL",
		available,
		onHold: 0,
		blocked: 0,
		version: 0,
		...overrides,
	});
}

function makeWalletRepo(wallet = makeWallet()): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => wallet,
		findByMerchantId: async () => wallet,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeBalanceRepo(
	balance = makeBalance(),
	overrides: Partial<IBalanceRepository> = {},
): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => balance,
		findAllByWalletId: async () => (balance ? [balance] : []),
		findByWalletIdForUpdateTx: async () => balance,
		update: async () => balance,
		updateTx: async (b) => b,
		...overrides,
	};
}

function makeLedgerTxRepo(): ILedgerTransactionRepository {
	return { createTx: async () => {} };
}

function makeLedgerEntryRepo(): ILedgerEntryRepository {
	return {
		create: async () => {},
		createManyTx: async () => {},
		findByTransactionId: async () => [],
	};
}

function makeHistoryRepo(): IAccountBalanceHistoryRepository {
	return { createTx: async () => {} };
}

function makeSut(
	overrides: {
		walletRepo?: IWalletRepository;
		balanceRepo?: IBalanceRepository;
	} = {},
) {
	return new CreditWalletBalance(
		overrides.walletRepo ?? makeWalletRepo(),
		makeLedgerTxRepo(),
		makeLedgerEntryRepo(),
		overrides.balanceRepo ?? makeBalanceRepo(),
		makeHistoryRepo(),
	);
}

describe("CreditWalletBalance — use case", () => {
	it("throws when amount is zero", async () => {
		const uc = makeSut();
		await assert.rejects(
			() =>
				uc.execute({ customerId: "cus_001", walletId: "wal_001", amount: 0 }),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});

	it("throws when amount is negative", async () => {
		const uc = makeSut();
		await assert.rejects(
			() =>
				uc.execute({
					customerId: "cus_001",
					walletId: "wal_001",
					amount: -100,
				}),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});

	it("throws when wallet does not exist", async () => {
		const uc = makeSut({ walletRepo: makeWalletRepo(null as any) });
		await assert.rejects(
			() =>
				uc.execute({ customerId: "cus_001", walletId: "wal_999", amount: 100 }),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("uses balance accountId when wallet has no accPix", async () => {
		const uc = makeSut({
			walletRepo: makeWalletRepo(
				makeWallet({ accPixIn: null, accPixOut: null }),
			),
			balanceRepo: makeBalanceRepo(
				makeBalance(0, { accountId: "acc_from_balance" }),
			),
		});
		const result = await uc.execute({
			customerId: "cus_001",
			walletId: "wal_001",
			amount: 100,
		});
		assert.equal(result.walletId, "wal_001");
		assert.equal(result.entries.length, 1);
	});

	it("throws BalanceNotFound when balance does not exist", async () => {
		const uc = makeSut({ balanceRepo: makeBalanceRepo(null as any) });
		await assert.rejects(
			() =>
				uc.execute({ customerId: "cus_001", walletId: "wal_001", amount: 100 }),
			(e) => e instanceof BalanceNotFound,
		);
	});

	it("throws on optimistic lock failure", async () => {
		const uc = makeSut({
			balanceRepo: makeBalanceRepo(makeBalance(), {
				updateTx: async () => null,
			}),
		});
		await assert.rejects(
			() =>
				uc.execute({ customerId: "cus_001", walletId: "wal_001", amount: 100 }),
			(e: Error) => e.message.includes("optimistic lock"),
		);
	});

	it("returns walletId, transactionId and entries on success", async () => {
		const uc = makeSut();
		const result = await uc.execute({
			customerId: "cus_001",
			walletId: "wal_001",
			amount: 100,
		});
		assert.equal(result.walletId, "wal_001");
		assert.match(result.transactionId, /^txn_/);
		assert.equal(result.entries.length, 1);
	});

	it("entry has direction=credit, type=adjustment, assetCode=BRL", async () => {
		const uc = makeSut();
		const result = await uc.execute({
			customerId: "cus_001",
			walletId: "wal_001",
			amount: 500,
		});
		const entry = result.entries[0];
		assert.equal(entry.direction, "credit");
		assert.equal(entry.type, "adjustment");
		assert.equal(entry.assetCode, "BRL");
		assert.equal(entry.amount, 500);
	});
});
