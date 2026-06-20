import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IBalanceRepository } from "@ledger/shared";
import {
	Balances,
	Infraction,
	InfractionStatus,
	InfractionType,
} from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { FetchBalanceStep } from "@/application/usecase/Infraction/pipeline/FetchBalanceStep";

const WALLET_ID = "wal_001";

function makeBalance(): Balances {
	return Balances.restore({
		id: "bal_001",
		walletId: WALLET_ID,
		assetCode: "BRL",
		available: 1000,
		onHold: 0,
		blocked: 0,
		version: 1,
	} as Parameters<typeof Balances.restore>[0]);
}

function makeInfraction(opts?: { noWallet?: boolean }): Infraction {
	return Infraction.restore({
		id: "inf_001",
		transactionId: "tx_001",
		externalId: "ext_001",
		walletId: opts?.noWallet ? undefined : WALLET_ID,
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IBalanceRepository> = {},
): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => makeBalance(),
		findAllByWalletId: async () => [],
		findByWalletIdForUpdateTx: async () => makeBalance(),
		update: async () => null,
		updateTx: async (b) => b,
		...overrides,
	};
}

describe("FetchBalanceStep", () => {
	it("returns ok true and sets ctx.balance when walletId exists and balance found", async () => {
		const step = new FetchBalanceStep(makeRepo());
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: "inf_001",
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.balance?.get("walletId"), WALLET_ID);
	});

	it("returns ok true (skips) when the infraction has no walletId", async () => {
		const step = new FetchBalanceStep(makeRepo());
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: "inf_001",
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction({ noWallet: true }),
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.balance, undefined);
	});

	it("returns ok true and leaves ctx.balance undefined when balance is not found", async () => {
		const step = new FetchBalanceStep(
			makeRepo({ findByWalletId: async () => null }),
		);
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: "inf_001",
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.balance, undefined);
	});
});
