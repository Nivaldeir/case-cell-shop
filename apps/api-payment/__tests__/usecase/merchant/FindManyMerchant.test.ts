import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository, IMerchantRepository } from "@ledger/shared";
import { CustomerNotFound, Customers, Merchants } from "@ledger/shared";
import { FindManyMerchant } from "@/application/usecase/Merchant/FindManyMerchant";

function makeMerchant(id: string, organizationId = "org_001"): Merchants {
	return Merchants.restore({
		id,
		organizationId,
		legalName: "Acme Merchant",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeRepo(
	items: Merchants[],
	totalItems: number,
	overrides: Partial<IMerchantRepository> = {},
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByOrganizationId: async () => [],
		update: async () => {},
		findMany: async () => ({ items, totalItems }),
		...overrides,
	};
}

function makeCustomerRepo(
	overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeCustomer(id: string, merchantId?: string): Customers {
	return Customers.restore({
		id,
		merchantId,
		name: "Jane",
		documentNumber: "123",
		status: "active",
	});
}

describe("FindManyMerchant — use case", () => {
	it("returns paginated merchants with correct metadata", async () => {
		const merchants = [makeMerchant("m_1"), makeMerchant("m_2")];
		const repo = makeRepo(merchants, 2);
		const result = await new FindManyMerchant(repo, makeCustomerRepo()).execute(
			{
				params: { page: 1, limit: 10, search: "" },
			},
		);
		assert.equal(result.items.length, 2);
		assert.equal(result.pagination.totalItems, 2);
	});

	it("forwards organizationId filter to repository", async () => {
		let capturedOrgId: string | undefined;
		const repo = makeRepo([], 0, {
			findMany: async (_p, _l, _s, orgId) => {
				capturedOrgId = orgId;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyMerchant(repo, makeCustomerRepo()).execute({
			params: { page: 1, limit: 5, search: "", organizationId: "org_target" },
		});
		assert.equal(capturedOrgId, "org_target");
	});

	it("passes undefined organizationId when not provided", async () => {
		let capturedOrgId: string | undefined = "sentinel";
		const repo = makeRepo([], 0, {
			findMany: async (_p, _l, _s, orgId) => {
				capturedOrgId = orgId;
				return { items: [], totalItems: 0 };
			},
		});
		await new FindManyMerchant(repo, makeCustomerRepo()).execute({
			params: { page: 1, limit: 5, search: "" },
		});
		assert.equal(capturedOrgId, undefined);
	});

	it("totalPages is at least 1 for empty result", async () => {
		const result = await new FindManyMerchant(
			makeRepo([], 0),
			makeCustomerRepo(),
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});
		assert.equal(result.pagination.totalPages, 1);
	});

	it("hasNextPage and hasPreviousPage are computed correctly", async () => {
		const repo = makeRepo([makeMerchant("m_1")], 15);
		const p1 = await new FindManyMerchant(repo, makeCustomerRepo()).execute({
			params: { page: 1, limit: 5, search: "" },
		});
		assert.equal(p1.pagination.hasNextPage, true);
		assert.equal(p1.pagination.hasPreviousPage, false);
		assert.equal(p1.pagination.totalPages, 3);

		const p3 = await new FindManyMerchant(repo, makeCustomerRepo()).execute({
			params: { page: 3, limit: 5, search: "" },
		});
		assert.equal(p3.pagination.hasNextPage, false);
		assert.equal(p3.pagination.hasPreviousPage, true);
	});

	it("returns merchant linked to customer when customerId is provided", async () => {
		const merchant = makeMerchant("mer_linked");
		const merchantRepo = makeRepo([], 0, {
			findById: async (id: string) => (id === "mer_linked" ? merchant : null),
		});
		const customerRepo = makeCustomerRepo({
			findById: async () => makeCustomer("cus_1", "mer_linked"),
		});
		const result = await new FindManyMerchant(
			merchantRepo,
			customerRepo,
		).execute({
			params: {
				page: 1,
				limit: 10,
				search: "",
				customerId: "cus_1",
			},
		});
		assert.equal(result.items.length, 1);
		assert.equal(result.items[0]?.get("id"), "mer_linked");
		assert.equal(result.pagination.totalItems, 1);
	});

	it("throws CustomerNotFound when customerId does not exist", async () => {
		const merchantRepo = makeRepo([], 0);
		const customerRepo = makeCustomerRepo({
			findById: async () => null,
		});
		await assert.rejects(
			() =>
				new FindManyMerchant(merchantRepo, customerRepo).execute({
					params: {
						page: 1,
						limit: 10,
						search: "",
						customerId: "cus_missing",
					},
				}),
			(e) => e instanceof CustomerNotFound,
		);
	});

	it("returns empty when customer has no merchant", async () => {
		const merchantRepo = makeRepo([], 0);
		const customerRepo = makeCustomerRepo({
			findById: async () => makeCustomer("cus_2", undefined),
		});
		const result = await new FindManyMerchant(
			merchantRepo,
			customerRepo,
		).execute({
			params: {
				page: 1,
				limit: 10,
				search: "",
				customerId: "cus_2",
			},
		});
		assert.equal(result.items.length, 0);
		assert.equal(result.pagination.totalItems, 0);
	});
});
