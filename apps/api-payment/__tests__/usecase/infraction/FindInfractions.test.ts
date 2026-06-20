import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import { Infraction, InfractionStatus, InfractionType } from "@ledger/shared";
import { FindInfractions } from "@/application/usecase/Infraction/FindInfractions";

function makeInfraction(overrides: Record<string, unknown> = {}): Infraction {
	return Infraction.restore({
		id: "00000000-0000-0000-0000-000000000010",
		transactionId: "00000000-0000-0000-0000-000000000011",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
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

describe("FindInfractions — use case", () => {
	it("forwards walletId, page and limit to the repository", async () => {
		let receivedFilters: unknown = null;
		const repo = makeRepo({
			findMany: async (filters) => {
				receivedFilters = filters;
				return { items: [], totalItems: 0 };
			},
		});

		await new FindInfractions(repo).execute({
			walletId: "wal_001",
			page: 2,
			limit: 10,
		});

		assert.deepEqual(receivedFilters, {
			walletId: "wal_001",
			page: 2,
			limit: 10,
		});
	});

	it("maps only id, status, type, amount and createdAt into each item", async () => {
		const infraction = makeInfraction();
		const repo = makeRepo({
			findMany: async () => ({ items: [infraction], totalItems: 1 }),
		});

		const result = await new FindInfractions(repo).execute({
			walletId: "wal_001",
			page: 1,
			limit: 20,
		});

		assert.equal(result.items.length, 1);
		assert.deepEqual(result.items[0], {
			id: infraction.get("id"),
			status: infraction.get("status"),
			type: infraction.get("type"),
			amount: infraction.get("amount"),
			createdAt: infraction.get("createdAt"),
		});
	});

	it("computes pagination from totalItems and limit", async () => {
		const repo = makeRepo({
			findMany: async () => ({ items: [makeInfraction()], totalItems: 25 }),
		});

		const result = await new FindInfractions(repo).execute({
			walletId: "wal_001",
			page: 2,
			limit: 10,
		});

		assert.deepEqual(result.pagination, {
			page: 2,
			limit: 10,
			totalItems: 25,
			totalPages: 3,
			hasNextPage: true,
			hasPreviousPage: true,
		});
	});

	it("returns totalPages=1 and no adjacent pages when there are no infractions", async () => {
		const result = await new FindInfractions(makeRepo()).execute({
			walletId: "wal_001",
			page: 1,
			limit: 20,
		});

		assert.deepEqual(result, {
			items: [],
			pagination: {
				page: 1,
				limit: 20,
				totalItems: 0,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			},
		});
	});
});
