import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionNotFoundError,
	InfractionStatus,
	InfractionType,
} from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { FetchInfractionStep } from "@/application/usecase/Infraction/pipeline/FetchInfractionStep";

const INFRACTION_ID = "00000000-0000-0000-0000-000000000001";

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: INFRACTION_ID,
		transactionId: "00000000-0000-0000-0000-000000000002",
		externalId: "ext_001",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
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

describe("FetchInfractionStep", () => {
	it("returns ok true and sets ctx.infraction when found", async () => {
		const step = new FetchInfractionStep(makeRepo());
		const ctx: InfractionPipelineContext = {
			input: { infractionId: INFRACTION_ID, status: InfractionStatus.OPEN },
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.infraction?.get("id"), INFRACTION_ID);
	});

	it("returns not_found when the infraction does not exist", async () => {
		const step = new FetchInfractionStep(
			makeRepo({ findById: async () => null }),
		);
		const ctx: InfractionPipelineContext = {
			input: { infractionId: "ghost", status: InfractionStatus.OPEN },
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, "not_found");
			assert.equal(result.step, "FetchInfraction");
			assert(result.error instanceof InfractionNotFoundError);
		}
	});
});
