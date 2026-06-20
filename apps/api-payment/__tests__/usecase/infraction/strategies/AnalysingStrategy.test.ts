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
	InfractionStatus,
	InfractionType,
	PaymentMethod,
	TransactionNotFoundError,
	TransactionNotPixError,
	TransactionStatus,
	Transactions,
	TransactionType,
} from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { AnalysingStrategy } from "@/application/usecase/Infraction/strategies/AnalysingStrategy";

const INFRACTION_ID = "inf_001";
const TRANSACTION_ID = "tx_001";
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
		createdAt: new Date(),
		updatedAt: new Date(),
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

describe("AnalysingStrategy", () => {
	it("blocks the infraction amount and persists both in a transaction", async () => {
		const balance = makeBalance({ available: 1000, blocked: 0 });
		let persistedBalance: Balances | undefined;
		let infractionPersistedTx = false;

		const strategy = new AnalysingStrategy(
			{
				update: async () => {},
				updateTx: async () => {
					infractionPersistedTx = true;
				},
			} as unknown as IInfractionRepository,
			{
				findByWalletIdForUpdateTx: async () => balance,
				updateTx: async (b: Balances) => {
					persistedBalance = b;
					return b;
				},
			} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction({ amount: 250 }),
			balance,
			transaction: makeTransaction(),
		};

		await strategy.execute(ctx);

		assert.equal(persistedBalance?.get("blocked"), 250);
		assert.equal(persistedBalance?.get("available"), 750);
		assert.equal(infractionPersistedTx, true);
	});

	it("skips blocking when already analysing (wasAnalysing=true)", async () => {
		let infractionUpdated = false;

		const strategy = new AnalysingStrategy(
			{
				update: async () => {
					infractionUpdated = true;
				},
				updateTx: async () => {},
			} as unknown as IInfractionRepository,
			{} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction({ status: InfractionStatus.ANALYSING }),
			balance: makeBalance(),
			transaction: makeTransaction(),
			wasAnalysing: true,
		};

		await strategy.execute(ctx);

		assert.equal(infractionUpdated, true);
	});

	it("throws InfractionAnalysisError when infraction has no walletId", async () => {
		const strategy = new AnalysingStrategy(
			{} as unknown as IInfractionRepository,
			{} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction({ walletId: undefined }),
			balance: makeBalance(),
			transaction: makeTransaction(),
		};

		await assert.rejects(
			() => strategy.execute(ctx),
			(e) => e instanceof InfractionAnalysisError,
		);
	});

	it("throws TransactionNotPixError when method is not PIX", async () => {
		const strategy = new AnalysingStrategy(
			{} as unknown as IInfractionRepository,
			{} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
			balance: makeBalance(),
			transaction: makeTransaction({ method: PaymentMethod.INTERNAL }),
		};

		await assert.rejects(
			() => strategy.execute(ctx),
			(e) => e instanceof TransactionNotPixError,
		);
	});

	it("throws BalanceNotFound when balance is not found within the transaction", async () => {
		const strategy = new AnalysingStrategy(
			{} as unknown as IInfractionRepository,
			{
				findByWalletIdForUpdateTx: async () => null,
			} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
			balance: makeBalance(),
			transaction: makeTransaction(),
		};

		await assert.rejects(
			() => strategy.execute(ctx),
			(e) => e instanceof BalanceNotFound,
		);
	});

	it("throws BalanceInsufficient when available is below the infraction amount", async () => {
		const strategy = new AnalysingStrategy(
			{} as unknown as IInfractionRepository,
			{
				findByWalletIdForUpdateTx: async () => makeBalance({ available: 50 }),
			} as unknown as IBalanceRepository,
			{} as unknown as ITransactionsRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction({ amount: 500 }),
			balance: makeBalance(),
			transaction: makeTransaction(),
		};

		await assert.rejects(
			() => strategy.execute(ctx),
			(e) => e instanceof BalanceInsufficient,
		);
	});
});
