import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository } from "@ledger/shared";
import { Customers } from "@ledger/shared";
import { FindManyCustomer } from "@/application/usecase/Customer/FindManyCustomer";

function makeCustomer(id: string): Customers {
	return Customers.restore({
		id,
		merchantId: "merch_001",
		externalId: `ext-${id}`,
		name: "john doe",
		documentNumber: "12345678901",
		email: "john@example.com",
		status: "active",
	});
}

function makeRepo(
	items: Customers[],
	totalItems: number,
	overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		update: async () => {},
		findMany: async () => ({ items, totalItems }),
		...overrides,
	};
}

describe("FindManyCustomer — use case", () => {
	it("returns paginated customers with correct metadata", async () => {
		const customers = [makeCustomer("cust_1"), makeCustomer("cust_2")];
		const repo = makeRepo(customers, 2);
		const result = await new FindManyCustomer(repo).execute({
			params: { page: 1, limit: 10, search: "", merchantId: "merch_001" },
		});
		assert.equal(result.items.length, 2);
		assert.equal(result.pagination.totalItems, 2);
		assert.equal(result.pagination.page, 1);
		assert.equal(result.pagination.limit, 10);
	});

	it("forwards merchantId to the repository", async () => {
		let capturedMerchantId: string | undefined;
		const repo = makeRepo([], 0, {
			findMany: async (_p, _l, _s, mId) => {
				capturedMerchantId = mId;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyCustomer(repo).execute({
			params: { page: 1, limit: 10, search: "", merchantId: "merch_target" },
		});
		assert.equal(capturedMerchantId, "merch_target");
	});

	it("totalPages is at least 1 for empty result", async () => {
		const result = await new FindManyCustomer(makeRepo([], 0)).execute({
			params: { page: 1, limit: 10, search: "", merchantId: "merch_001" },
		});
		assert.equal(result.pagination.totalPages, 1);
	});

	it("hasNextPage is true when not on last page", async () => {
		const repo = makeRepo([makeCustomer("cust_1")], 30);
		const result = await new FindManyCustomer(repo).execute({
			params: { page: 1, limit: 10, search: "", merchantId: "merch_001" },
		});
		assert.equal(result.pagination.hasNextPage, true);
		assert.equal(result.pagination.totalPages, 3);
	});

	it("hasPreviousPage is true from page 2 onwards", async () => {
		const repo = makeRepo([makeCustomer("cust_1")], 30);
		const result = await new FindManyCustomer(repo).execute({
			params: { page: 2, limit: 10, search: "", merchantId: "merch_001" },
		});
		assert.equal(result.pagination.hasPreviousPage, true);
	});

	it("forwards search param to repository", async () => {
		let capturedSearch: string | undefined;
		const repo = makeRepo([], 0, {
			findMany: async (_p, _l, s) => {
				capturedSearch = s;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyCustomer(repo).execute({
			params: { page: 1, limit: 10, search: "john", merchantId: "merch_001" },
		});
		assert.equal(capturedSearch, "john");
	});
});
