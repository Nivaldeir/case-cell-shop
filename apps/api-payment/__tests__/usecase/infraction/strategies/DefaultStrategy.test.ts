import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import { Infraction, InfractionStatus, InfractionType } from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { DefaultStrategy } from "@/application/usecase/Infraction/strategies/DefaultStrategy";

const INFRACTION_ID = "inf_001";

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: INFRACTION_ID,
		transactionId: "tx_001",
		externalId: "ext_001",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.CLOSED,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Parameters<typeof Infraction.restore>[0]);
}

describe("DefaultStrategy", () => {
	it("calls infractionRepository.update with the infraction", async () => {
		let updatedInfraction: Infraction | undefined;

		const strategy = new DefaultStrategy({
			update: async (i: Infraction) => {
				updatedInfraction = i;
			},
		} as unknown as IInfractionRepository);

		const infraction = makeInfraction();
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: INFRACTION_ID,
				status: InfractionStatus.CLOSED,
			},
			infraction,
		};

		await strategy.execute(ctx);

		assert.equal(updatedInfraction, infraction);
	});
});
