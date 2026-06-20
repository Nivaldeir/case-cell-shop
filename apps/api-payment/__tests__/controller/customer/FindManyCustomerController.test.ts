import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindManyCustomer } from "@/application/usecase/Customer/FindManyCustomer";
import { FindManyCustomerController } from "@/presentation/api/controllers/customers/FindManyCustomerController";

function makeRepo(
	overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
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

describe("FindManyCustomerController — unit", () => {
	it("responds 200 with empty list", async () => {
		const ctrl = new FindManyCustomerController(
			new FindManyCustomer(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_001", page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and empty data array", async () => {
		const ctrl = new FindManyCustomerController(
			new FindManyCustomer(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_001", page: 1, limit: 10, search: "" }),
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
		const ctrl = new FindManyCustomerController(
			new FindManyCustomer(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_001", page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		const body = res.body as {
			pagination: {
				page: number;
				limit: number;
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

	it("forwards merchantId to use case", async () => {
		let capturedMerchantId: string | undefined;
		const repo = makeRepo({
			findMany: async (_page, _limit, _search, merchantId) => {
				capturedMerchantId = merchantId;
				return { items: [], totalItems: 0 };
			},
		});
		const ctrl = new FindManyCustomerController(new FindManyCustomer(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_target", page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		assert.equal(capturedMerchantId, "merch_target");
	});
});
