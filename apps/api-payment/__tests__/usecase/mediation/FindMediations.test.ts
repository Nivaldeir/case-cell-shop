import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IMediationRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionStatus,
	InfractionType,
	Mediation,
} from "@ledger/shared";
import { FindMediations } from "@/application/usecase/Mediation/FindMediations";

function makeMediation(overrides: Record<string, unknown> = {}): Mediation {
	return Mediation.restore({
		id: "00000000-0000-0000-0000-000000000020",
		infractionId: "00000000-0000-0000-0000-000000000010",
		defense: "the transaction was authorized",
		attachments: ["https://s3/evidence.png"],
		createdAt: new Date("2026-02-01"),
		updatedAt: new Date("2026-02-01"),
		...overrides,
	} as Parameters<typeof Mediation.restore>[0]);
}

function makeInfraction(overrides: Record<string, unknown> = {}): Infraction {
	return Infraction.restore({
		id: "00000000-0000-0000-0000-000000000010",
		transactionId: "00000000-0000-0000-0000-000000000011",
		walletId: "wal_001",
		accountId: "acc_001",
		merchantId: "mer_001",
		providerCode: "fyhub",
		status: InfractionStatus.APPROVED,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
		...overrides,
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IMediationRepository> = {},
): IMediationRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByInfractionId: async () => null,
		existsByInfractionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		...overrides,
	};
}

describe("FindMediations — use case", () => {
	it("forwards merchantId, accountId, walletId, page and limit to the repository", async () => {
		let receivedFilters: unknown = null;
		const repo = makeRepo({
			findMany: async (filters) => {
				receivedFilters = filters;
				return { items: [], totalItems: 0 };
			},
		});

		await new FindMediations(repo).execute({
			merchantId: "mer_001",
			accountId: "acc_001",
			walletId: "wal_001",
			page: 2,
			limit: 10,
		});

		assert.deepEqual(receivedFilters, {
			merchantId: "mer_001",
			accountId: "acc_001",
			walletId: "wal_001",
			page: 2,
			limit: 10,
		});
	});

	it("maps each row into a curated { mediation, infraction } pair", async () => {
		const mediation = makeMediation();
		const infraction = makeInfraction();
		const repo = makeRepo({
			findMany: async () => ({
				items: [{ mediation, infraction }],
				totalItems: 1,
			}),
		});

		const result = await new FindMediations(repo).execute({
			merchantId: "mer_001",
			page: 1,
			limit: 20,
		});

		assert.equal(result.items.length, 1);
		assert.deepEqual(result.items[0], {
			mediation: {
				id: mediation.get("id"),
				infractionId: mediation.get("infractionId"),
				defense: mediation.get("defense") ?? null,
				attachments: mediation.get("attachments"),
				createdAt: mediation.get("createdAt"),
			},
			infraction: {
				id: infraction.get("id"),
				status: infraction.get("status"),
				type: infraction.get("type"),
				amount: infraction.get("amount"),
				createdAt: infraction.get("createdAt"),
			},
		});
	});

	it("computes pagination from totalItems and limit", async () => {
		const repo = makeRepo({
			findMany: async () => ({
				items: [{ mediation: makeMediation(), infraction: makeInfraction() }],
				totalItems: 25,
			}),
		});

		const result = await new FindMediations(repo).execute({
			merchantId: "mer_001",
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

	it("returns totalPages=1 and no adjacent pages when there are no mediations", async () => {
		const result = await new FindMediations(makeRepo()).execute({
			merchantId: "mer_001",
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

	it("defense maps to null when absent", async () => {
		const repo = makeRepo({
			findMany: async () => ({
				items: [
					{
						mediation: makeMediation({ defense: null }),
						infraction: makeInfraction(),
					},
				],
				totalItems: 1,
			}),
		});

		const result = await new FindMediations(repo).execute({
			merchantId: "mer_001",
			page: 1,
			limit: 20,
		});

		assert.equal(result.items[0]?.mediation.defense, null);
	});
});
