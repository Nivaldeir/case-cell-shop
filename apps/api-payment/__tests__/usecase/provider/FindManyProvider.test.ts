import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import { Providers } from "@ledger/shared";
import { FindManyProvider } from "@/application/usecase/Provider/FindManyProvider";

function makeProvider(overrides: Record<string, unknown> = {}): Providers {
	return Providers.restore({
		id: "prov_test",
		code: "BANK",
		name: "Bank",
		slug: "bank",
		pixIn: true,
		pixOut: false,
		dict: false,
		refund: false,
		status: "active",
		description: "desc",
		...overrides,
	});
}

function makeRepo(
	overrides: Partial<IProviderRepository> = {},
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByIds: async () => [],
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({
			items: [],
			totalItems: 0,
			totalActive: 0,
			totalInactive: 0,
		}),
		update: async () => {},
		...overrides,
	};
}

describe("FindManyProvider — use case", () => {
	it("returns items and correct pagination on first page", async () => {
		const providers = [
			makeProvider({ id: "prov_1" }),
			makeProvider({ id: "prov_2" }),
		];
		const repo = makeRepo({
			findMany: async () => ({
				items: providers,
				totalItems: 2,
				totalActive: 2,
				totalInactive: 0,
			}),
		});
		const result = await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 10 },
		});
		assert.equal(result.items.length, 2);
		assert.equal(result.pagination.page, 1);
		assert.equal(result.pagination.limit, 10);
		assert.equal(result.pagination.totalItems, 2);
		assert.equal(result.pagination.totalPages, 1);
		assert.equal(result.pagination.hasNextPage, false);
		assert.equal(result.pagination.hasPreviousPage, false);
		assert.equal(result.summary.totalItems, 2);
		assert.equal(result.summary.totalActive, 2);
		assert.equal(result.summary.totalInactive, 0);
	});

	it("calculates totalPages correctly", async () => {
		const providers = Array.from({ length: 5 }, (_, i) =>
			makeProvider({ id: `prov_${i}` }),
		);
		const repo = makeRepo({
			findMany: async () => ({
				items: providers,
				totalItems: 25,
				totalActive: 20,
				totalInactive: 5,
			}),
		});
		const result = await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 5 },
		});
		assert.equal(result.pagination.totalPages, 5);
	});

	it("sets hasNextPage=true when there are more pages", async () => {
		const repo = makeRepo({
			findMany: async () => ({
				items: [makeProvider()],
				totalItems: 20,
				totalActive: 15,
				totalInactive: 5,
			}),
		});
		const result = await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 10 },
		});
		assert.equal(result.pagination.hasNextPage, true);
		assert.equal(result.pagination.hasPreviousPage, false);
	});

	it("sets hasPreviousPage=true on subsequent pages", async () => {
		const repo = makeRepo({
			findMany: async () => ({
				items: [makeProvider()],
				totalItems: 20,
				totalActive: 15,
				totalInactive: 5,
			}),
		});
		const result = await new FindManyProvider(repo).execute({
			params: { page: 2, limit: 10 },
		});
		assert.equal(result.pagination.hasPreviousPage, true);
	});

	it("totalPages is at least 1 even when there are no items", async () => {
		const repo = makeRepo({
			findMany: async () => ({
				items: [],
				totalItems: 0,
				totalActive: 0,
				totalInactive: 0,
			}),
		});
		const result = await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 10 },
		});
		assert.equal(result.pagination.totalPages, 1);
		assert.equal(result.items.length, 0);
	});

	it("forwards the search param to the repository", async () => {
		let capturedSearch: string | undefined;
		const repo = makeRepo({
			findMany: async (_page, _limit, search) => {
				capturedSearch = search;
				return {
					items: [],
					totalItems: 0,
					totalActive: 0,
					totalInactive: 0,
				};
			},
		});
		await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 10, search: "acme" },
		});
		assert.equal(capturedSearch, "acme");
	});

	it("passes empty string to repo when search is undefined", async () => {
		let capturedSearch: string | undefined;
		const repo = makeRepo({
			findMany: async (_p, _l, s) => {
				capturedSearch = s;
				return {
					items: [],
					totalItems: 0,
					totalActive: 0,
					totalInactive: 0,
				};
			},
		});
		await new FindManyProvider(repo).execute({
			params: { page: 1, limit: 10 },
		});
		assert.equal(capturedSearch, "");
	});
});
