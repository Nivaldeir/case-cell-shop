import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IBalanceRepository, IWalletRepository } from "@ledger/shared";
import {
	BalanceInsufficient,
	BalanceNotFound,
	Balances,
	Wallet,
	WalletNotFoundError,
} from "@ledger/shared";
import { DebitWalletBalance } from "@/application/usecase/Wallet/balances/DebitWalletBalance";

function makeWallet(accPixOut = "acc_001") {
	return Wallet.restore({
		id: "wal_001",
		merchantId: "merch_001",
		accPixOut,
		accPixIn: null,
	});
}

function makeBalance(available = 1000) {
	return Balances.restore({
		id: "bal_001",
		walletId: "wal_001",
		assetCode: "BRL",
		available,
		onHold: 0,
		blocked: 0,
		version: 0,
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
		findByAccountId: async () => balance,
		findByWalletId: async () => balance,
		findAllByWalletId: async () => (balance ? [balance] : []),
		findByWalletIdForUpdateTx: async () => balance,
		update: async () => balance,
		updateTx: async (b) => b,
		...overrides,
	};
}

function makeSut(
	overrides: {
		walletRepo?: IWalletRepository;
		balanceRepo?: IBalanceRepository;
	} = {},
) {
	return new DebitWalletBalance(
		overrides.walletRepo ?? makeWalletRepo(),
		{ createTx: async () => {} },
		{
			create: async () => {},
			createManyTx: async () => {},
			findByTransactionId: async () => [],
		},
		overrides.balanceRepo ?? makeBalanceRepo(),
		{ createTx: async () => {} },
	);
}

describe("DebitWalletBalance — use case", () => {
	it("throws when amount is zero", async () => {
		await assert.rejects(
			() =>
				makeSut().execute({
					walletId: "wal_001",
					amount: 0,
					customerId: "cus_001",
				}),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});

	it("throws when amount is negative", async () => {
		await assert.rejects(
			() =>
				makeSut().execute({
					walletId: "wal_001",
					amount: -50,
					customerId: "cus_001",
				}),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});

	it("throws when wallet does not exist", async () => {
		const uc = makeSut({ walletRepo: makeWalletRepo(null as any) });
		await assert.rejects(
			() =>
				uc.execute({ walletId: "wal_999", amount: 100, customerId: "cus_001" }),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("throws when wallet has no linked account", async () => {
		const walletNoAcc = Wallet.restore({
			id: "wal_001",
			merchantId: "merch_001",
			accPixOut: null,
			accPixIn: null,
		});
		const uc = makeSut({ walletRepo: makeWalletRepo(walletNoAcc) });
		await assert.rejects(
			() =>
				uc.execute({ walletId: "wal_001", amount: 100, customerId: "cus_001" }),
			(e: Error) => e.message.includes("no linked account"),
		);
	});

	it("throws BalanceNotFound when balance does not exist", async () => {
		const uc = makeSut({ balanceRepo: makeBalanceRepo(null as any) });
		await assert.rejects(
			() =>
				uc.execute({ walletId: "wal_001", amount: 100, customerId: "cus_001" }),
			(e) => e instanceof BalanceNotFound,
		);
	});

	it("throws BalanceInsufficient when available is less than amount", async () => {
		const uc = makeSut({ balanceRepo: makeBalanceRepo(makeBalance(50)) });
		await assert.rejects(
			() =>
				uc.execute({ walletId: "wal_001", amount: 100, customerId: "cus_001" }),
			(e) => e instanceof BalanceInsufficient,
		);
	});

	it("returns walletId, transactionId, idempotencyKey and entries on success", async () => {
		const uc = makeSut();
		const result = await uc.execute({
			walletId: "wal_001",
			amount: 100,
			customerId: "cus_001",
		});
		assert.equal(result.walletId, "wal_001");
		assert.match(result.transactionId, /^txn_/);
		assert.equal(result.entries.length, 1);
		assert.equal(result.entries[0].direction, "debit");
		assert.equal(result.entries[0].amount, 100);
	});
});
