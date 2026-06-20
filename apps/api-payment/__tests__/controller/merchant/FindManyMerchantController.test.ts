import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository, IMerchantRepository } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindManyMerchant } from "@/application/usecase/Merchant/FindManyMerchant";
import { FindManyMerchantController } from "@/presentation/api/controllers/merchants/FindManyMerchantController";

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

function makeRepo(
	overrides: Partial<IMerchantRepository> = {},
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeReq(query: Record<string, unknown>): Request {
	return { query, body: {}, params: {} } as unknown as Request;
}

type MockRes = {
	statusCode: number;
	body: unknown;
	status(c: number): MockRes;
	json(d: unknown): MockRes;
};
function makeRes(): MockRes {
	const r: MockRes = {
		statusCode: 200,
		body: undefined,
		status(c) {
			this.statusCode = c;
			return this;
		},
		json(d) {
			this.body = d;
			return this;
		},
	};
	return r;
}

describe("FindManyMerchantController — unit", () => {
	it("responds 200 with empty list", async () => {
		const ctrl = new FindManyMerchantController(
			new FindManyMerchant(makeRepo(), makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and empty data array", async () => {
		const ctrl = new FindManyMerchantController(
			new FindManyMerchant(makeRepo(), makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: unknown[];
			pagination: object;
		};
		assert.equal(body.error, false);
		assert.deepEqual(body.data, []);
	});

	it("response body has pagination shape", async () => {
		const ctrl = new FindManyMerchantController(
			new FindManyMerchant(makeRepo(), makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		const body = res.body as {
			pagination: {
				totalItems: number;
				totalPages: number;
				hasNextPage: boolean;
				hasPreviousPage: boolean;
			};
		};
		assert.equal(body.pagination.totalItems, 0);
		assert.equal(body.pagination.totalPages, 1);
		assert.equal(body.pagination.hasNextPage, false);
		assert.equal(body.pagination.hasPreviousPage, false);
	});

	it("forwards organizationId to use case", async () => {
		let capturedOrgId: string | undefined;
		const repo = makeRepo({
			findMany: async (_page, _limit, _search, organizationId) => {
				capturedOrgId = organizationId;
				return { items: [], totalItems: 0 };
			},
		});
		const ctrl = new FindManyMerchantController(
			new FindManyMerchant(repo, makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "", organizationId: "org_target" }),
			res as unknown as Response,
		);
		assert.equal(capturedOrgId, "org_target");
	});
});
