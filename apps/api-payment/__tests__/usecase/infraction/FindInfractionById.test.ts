import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionNotFoundError,
	InfractionStatus,
	InfractionType,
} from "@ledger/shared";
import { FindInfractionById } from "@/application/usecase/Infraction/FindInfractionById";

function makeInfraction(overrides: Record<string, unknown> = {}): Infraction {
	return Infraction.restore({
		id: "00000000-0000-0000-0000-000000000010",
		transactionId: "00000000-0000-0000-0000-000000000011",
		externalId: "ext_001",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
		...overrides,
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IInfractionRepository> = {},
): IInfractionRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByTransactionId: async () => null,
		existsByTransactionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

describe("FindInfractionById — use case", () => {
	it("forwards the infractionId to the repository", async () => {
		let receivedId: string | undefined;
		const repo = makeRepo({
			findById: async (id) => {
				receivedId = id;
				return makeInfraction();
			},
		});

		await new FindInfractionById(repo).execute({
			infractionId: "00000000-0000-0000-0000-000000000010",
		});

		assert.equal(receivedId, "00000000-0000-0000-0000-000000000010");
	});

	it("maps the full infraction detail when found", async () => {
		const infraction = makeInfraction();
		const repo = makeRepo({ findById: async () => infraction });

		const result = await new FindInfractionById(repo).execute({
			infractionId: infraction.get("id")!,
		});

		assert.deepEqual(result, {
			id: infraction.get("id"),
			transactionId: infraction.get("transactionId"),
			externalId: infraction.get("externalId"),
			walletId: infraction.get("walletId"),
			providerCode: infraction.get("providerCode"),
			status: infraction.get("status"),
			type: infraction.get("type"),
			amount: infraction.get("amount"),
			createdAt: infraction.get("createdAt"),
			updatedAt: infraction.get("updatedAt"),
		});
	});

	it("throws InfractionNotFoundError when the infraction does not exist", async () => {
		await assert.rejects(
			() =>
				new FindInfractionById(makeRepo()).execute({ infractionId: "ghost" }),
			(e) => e instanceof InfractionNotFoundError,
		);
	});

	it("the thrown error has statusCode 404", async () => {
		await assert.rejects(
			() =>
				new FindInfractionById(makeRepo()).execute({ infractionId: "ghost" }),
			(e) => (e as InfractionNotFoundError).statusCode === 404,
		);
	});
});
