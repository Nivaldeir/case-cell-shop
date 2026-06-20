import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { IBalanceRepository, IInfractionRepository } from "@ledger/shared";
import {
	Balances,
	Infraction,
	InfractionStatus,
	InfractionType,
	PaymentMethod,
	runInTransaction,
	TransactionStatus,
	Transactions,
	TransactionType,
} from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { RejectedStrategy } from "@/application/usecase/Infraction/strategies/RejectedStrategy";

const INFRACTION_ID = "inf_001";
const WALLET_ID = "wal_001";

function makeInfraction(overrides: Record<string, unknown> = {}): Infraction {
	return Infraction.restore({
		id: INFRACTION_ID,
		transactionId: "tx_001",
		externalId: "ext_001",
		walletId: WALLET_ID,
		providerCode: "fyhub",
		status: InfractionStatus.REJECTED,
		type: InfractionType.FRAUD,
		amount: 200,
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
		available: 800,
		onHold: 0,
		blocked: 200,
		version: 1,
		...overrides,
	} as Parameters<typeof Balances.restore>[0]);
}

describe("RejectedStrategy", () => {
	it("unblocks the infraction amount and persists both in a transaction", async () => {
		const balance = makeBalance({ blocked: 200, available: 800 });

		let persistedBalance: Balances | undefined;
		let infractionPersisted = false;

		const strategy = new RejectedStrategy(
			{
				update: async () => {},
				updateTx: async () => {
					infractionPersisted = true;
				},
			} as unknown as IInfractionRepository,
			{
				findByWalletIdForUpdateTx: async () => balance,
				updateTx: async (b: Balances) => {
					persistedBalance = b;
					return b;
				},
			} as unknown as IBalanceRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.REJECTED,
			},
			infraction: makeInfraction(),
			balance,
		};

		await strategy.execute(ctx);

		assert.equal(persistedBalance?.get("blocked"), 0);
		assert.equal(persistedBalance?.get("available"), 1000);
		assert.equal(infractionPersisted, true);
	});

	it("calls update() (no transaction) when there is no balance in context", async () => {
		let updated = false;

		const strategy = new RejectedStrategy(
			{
				update: async () => {
					updated = true;
				},
				updateTx: async () => {},
			} as unknown as IInfractionRepository,
			{} as unknown as IBalanceRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.REJECTED,
			},
			infraction: makeInfraction(),
			balance: undefined,
		};

		await strategy.execute(ctx);

		assert.equal(updated, true);
	});

	it("throws when balance is found in pipeline but not in transaction", async () => {
		const strategy = new RejectedStrategy(
			{} as unknown as IInfractionRepository,
			{
				findByWalletIdForUpdateTx: async () => null,
			} as unknown as IBalanceRepository,
		);

		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.REJECTED,
			},
			infraction: makeInfraction(),
			balance: makeBalance(),
		};

		await assert.rejects(
			() => strategy.execute(ctx),
			(e) =>
				e instanceof Error &&
				e.message === "Balance not found within transaction",
		);
	});
});
