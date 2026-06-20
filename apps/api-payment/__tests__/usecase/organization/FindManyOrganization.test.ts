import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IOrganizationRepository } from "@ledger/shared";
import { Organizations } from "@ledger/shared";
import { FindManyOrganization } from "@/application/usecase/Organization/FindManyOrganization";

function makeOrg(id: string): Organizations {
	return Organizations.restore({
		id,
		externalId: `ext-${id}`,
		parentOrganizationId: null,
		legalName: "Acme Corp",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeRepo(
	items: Organizations[],
	totalItems: number,
	overrides: Partial<IOrganizationRepository> = {},
): IOrganizationRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByExternalId: async () => null,
		findMany: async () => ({ items, totalItems }),
		...overrides,
	};
}

describe("FindManyOrganization — use case", () => {
	it("returns paginated organizations with correct metadata", async () => {
		const orgs = [makeOrg("org_1"), makeOrg("org_2"), makeOrg("org_3")];
		const repo = makeRepo(orgs, 3);
		const result = await new FindManyOrganization(repo).execute({
			params: { page: 1, limit: 10, search: "" },
		});
		assert.equal(result.items.length, 3);
		assert.equal(result.pagination.page, 1);
		assert.equal(result.pagination.limit, 10);
		assert.equal(result.pagination.totalItems, 3);
		assert.equal(result.pagination.totalPages, 1);
		assert.equal(result.pagination.hasNextPage, false);
		assert.equal(result.pagination.hasPreviousPage, false);
	});

	it("totalPages is at least 1 for empty result", async () => {
		const result = await new FindManyOrganization(makeRepo([], 0)).execute({
			params: { page: 1, limit: 10, search: "" },
		});
		assert.equal(result.pagination.totalPages, 1);
	});

	it("correctly computes multi-page pagination", async () => {
		const repo = makeRepo([makeOrg("org_1")], 50);
		const result = await new FindManyOrganization(repo).execute({
			params: { page: 2, limit: 10, search: "" },
		});
		assert.equal(result.pagination.totalPages, 5);
		assert.equal(result.pagination.hasNextPage, true);
		assert.equal(result.pagination.hasPreviousPage, true);
	});

	it("forwards the search param to the repository", async () => {
		let capturedSearch: string | undefined;
		const repo = makeRepo([], 0, {
			findMany: async (_p, _l, s) => {
				capturedSearch = s;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyOrganization(repo).execute({
			params: { page: 1, limit: 10, search: "acme" },
		});
		assert.equal(capturedSearch, "acme");
	});

	it("forwards page and limit to the repository", async () => {
		let capturedPage: number | undefined;
		let capturedLimit: number | undefined;
		const repo = makeRepo([], 0, {
			findMany: async (p, l) => {
				capturedPage = p;
				capturedLimit = l;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyOrganization(repo).execute({
			params: { page: 3, limit: 25, search: "" },
		});
		assert.equal(capturedPage, 3);
		assert.equal(capturedLimit, 25);
	});
});
