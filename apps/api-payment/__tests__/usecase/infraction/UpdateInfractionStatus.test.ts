import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IBalanceRepository,
	IInfractionRepository,
	ITransactionsRepository,
} from "@ledger/shared";
import {
	BalanceInsufficient,
	BalanceNotFound,
	Balances,
	Infraction,
	InfractionAnalysisError,
	InfractionNotFoundError,
	InfractionStatus,
	InfractionType,
	PaymentMethod,
	TransactionNotFoundError,
	TransactionNotPixError,
	TransactionStatus,
	Transactions,
	TransactionType,
} from "@ledger/shared";
import { UpdateInfractionStatus } from "@/application/usecase/Infraction/UpdateInfractionStatus";

const INFRACTION_ID = "00000000-0000-0000-0000-000000000010";
const TRANSACTION_ID = "00000000-0000-0000-0000-000000000011";
const WALLET_ID = "wal_001";

function makeInfraction(overrides: Record<string, unknown> = {}): Infraction {
	return Infraction.restore({
		id: INFRACTION_ID,
		transactionId: TRANSACTION_ID,
		externalId: "ext_001",
		walletId: WALLET_ID,
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
		...overrides,
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeBalance(overrides: Record<string, unknown> = {}): Balances {
	return Balances.restore({
		id: "bal_001",
		walletId: WALLET_ID,
		assetCode: "BRL",
		available: 1000,
		onHold: 0,
		blocked: 0,
		version: 1,
		...overrides,
	} as Parameters<typeof Balances.restore>[0]);
}

function makeTransaction(
	overrides: Record<string, unknown> = {},
): Transactions {
	return Transactions.restore({
		id: TRANSACTION_ID,
		amount: 100,
		currency: "BRL",
		accountId: "acc_001",
		type: TransactionType.PIX_IN,
		externalId: "ext_001",
		customerId: "cus_001",
		providerCode: "fyhub",
		status: TransactionStatus.COMPLETED,
		method: PaymentMethod.PIX,
		walletId: WALLET_ID,
		...overrides,
	} as Parameters<typeof Transactions.restore>[0]);
}

function makeInfractionRepo(
	overrides: Partial<IInfractionRepository> = {},
): IInfractionRepository {
	return {
		create: async () => {},
		findById: async () => makeInfraction(),
		findByTransactionId: async () => null,
		existsByTransactionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		updateTx: async () => {},
		...overrides,
	};
}

function makeBalanceRepo(
	overrides: Partial<IBalanceRepository> = {},
): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => null,
		findAllByWalletId: async () => [],
		findByWalletIdForUpdateTx: async () => makeBalance(),
		update: async () => null,
		updateTx: async (b) => b,
		...overrides,
	};
}

function makeTransactionRepo(
	findById: ITransactionsRepository["findById"] = async () => makeTransaction(),
): ITransactionsRepository {
	return { findById } as unknown as ITransactionsRepository;
}

describe("UpdateInfractionStatus — use case", () => {
	it("throws InfractionNotFoundError when the infraction does not exist", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({ findById: async () => null }),
			makeBalanceRepo(),
			makeTransactionRepo(),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: "ghost",
					status: InfractionStatus.CLOSED,
				}),
			(e) => e instanceof InfractionNotFoundError,
		);
	});

	it("updates a non-analysing status via update() and never touches the balance", async () => {
		let updatedStatus: string | undefined;
		let balanceTouched = false;
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				update: async (i) => {
					updatedStatus = i.get("status");
				},
			}),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => {
					balanceTouched = true;
					return makeBalance();
				},
			}),
			makeTransactionRepo(),
		);

		const result = await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.CLOSED,
		});

		assert.equal(updatedStatus, InfractionStatus.CLOSED);
		assert.equal(result.status, InfractionStatus.CLOSED);
		assert.equal(balanceTouched, false);
	});

	it("acknowledging does not block the balance", async () => {
		let balanceTouched = false;
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => {
					balanceTouched = true;
					return makeBalance();
				},
			}),
			makeTransactionRepo(),
		);

		const result = await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.ACKNOWLEDGED,
		});

		assert.equal(result.status, InfractionStatus.ACKNOWLEDGED);
		assert.equal(balanceTouched, false);
	});

	it("analysing a pix BRL transaction blocks the infraction amount", async () => {
		const balance = makeBalance({ available: 1000, blocked: 0 });
		let persistedBalance: Balances | undefined;
		let infractionPersistedTx = false;
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () => makeInfraction({ amount: 250 }),
				updateTx: async () => {
					infractionPersistedTx = true;
				},
			}),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => balance,
				updateTx: async (b) => {
					persistedBalance = b;
					return b;
				},
			}),
			makeTransactionRepo(),
		);

		const result = await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.ANALYSING,
		});

		assert.equal(result.status, InfractionStatus.ANALYSING);
		assert.equal(persistedBalance?.get("blocked"), 250);
		assert.equal(persistedBalance?.get("available"), 750);
		assert.equal(infractionPersistedTx, true);
	});

	it("throws TransactionNotPixError when the transaction method is not pix", async () => {
		let balanceTouched = false;
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => {
					balanceTouched = true;
					return makeBalance();
				},
			}),
			makeTransactionRepo(async () =>
				makeTransaction({ method: PaymentMethod.INTERNAL }),
			),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof TransactionNotPixError,
		);
		assert.equal(balanceTouched, false);
	});

	it("throws TransactionNotPixError when the transaction type is not pix_in", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo(),
			makeTransactionRepo(async () =>
				makeTransaction({ type: TransactionType.PIX_OUT }),
			),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof TransactionNotPixError,
		);
	});

	it("throws TransactionNotPixError when the transaction currency is not BRL", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo(),
			makeTransactionRepo(async () => makeTransaction({ currency: "USD" })),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof TransactionNotPixError,
		);
	});

	it("throws TransactionNotFoundError when the transaction does not exist", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo(),
			makeTransactionRepo(async () => null),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof TransactionNotFoundError,
		);
	});

	it("does not re-block when the infraction is already analysing", async () => {
		let balanceTouched = false;
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () =>
					makeInfraction({ status: InfractionStatus.ANALYSING }),
			}),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => {
					balanceTouched = true;
					return makeBalance();
				},
			}),
			makeTransactionRepo(),
		);

		await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.ANALYSING,
		});

		assert.equal(balanceTouched, false);
	});

	it("throws InfractionAnalysisError when analysing an infraction without a wallet", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () => makeInfraction({ walletId: undefined }),
			}),
			makeBalanceRepo(),
			makeTransactionRepo(),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof InfractionAnalysisError,
		);
	});

	it("throws BalanceNotFound when analysing and the wallet has no balance", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo({ findByWalletIdForUpdateTx: async () => null }),
			makeTransactionRepo(),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof BalanceNotFound,
		);
	});

	it("throws BalanceInsufficient when available is below the infraction amount", async () => {
		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () => makeInfraction({ amount: 5000 }),
			}),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => makeBalance({ available: 100 }),
			}),
			makeTransactionRepo(),
		);

		await assert.rejects(
			() =>
				usecase.execute({
					infractionId: INFRACTION_ID,
					status: InfractionStatus.ANALYSING,
				}),
			(e) => e instanceof BalanceInsufficient,
		);
	});

	// ── REJECTED ───────────────────────────────────────────────────────────────

	it("rejecting with a balance unblocks the infraction amount", async () => {
		const balance = makeBalance({ available: 800, blocked: 200 });
		let persistedBalance: Balances | undefined;
		let infractionPersistedTx = false;

		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () => makeInfraction({ amount: 200 }),
				updateTx: async () => {
					infractionPersistedTx = true;
				},
			}),
			makeBalanceRepo({
				findByWalletId: async () => balance,
				findByWalletIdForUpdateTx: async () => balance,
				updateTx: async (b) => {
					persistedBalance = b;
					return b;
				},
			}),
			makeTransactionRepo(),
		);

		const result = await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.REJECTED,
		});

		assert.equal(result.status, InfractionStatus.REJECTED);
		assert.equal(persistedBalance?.get("blocked"), 0);
		assert.equal(persistedBalance?.get("available"), 1000);
		assert.equal(infractionPersistedTx, true);
	});

	it("rejecting without a walletId just updates the infraction", async () => {
		let balanceTouched = false;
		let infractionUpdated = false;

		const usecase = new UpdateInfractionStatus(
			makeInfractionRepo({
				findById: async () => makeInfraction({ walletId: undefined }),
				update: async () => {
					infractionUpdated = true;
				},
			}),
			makeBalanceRepo({
				findByWalletIdForUpdateTx: async () => {
					balanceTouched = true;
					return makeBalance();
				},
			}),
			makeTransactionRepo(),
		);

		const result = await usecase.execute({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.REJECTED,
		});

		assert.equal(result.status, InfractionStatus.REJECTED);
		assert.equal(balanceTouched, false);
		assert.equal(infractionUpdated, true);
	});
});
