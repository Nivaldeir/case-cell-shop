import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IOrganizationRepository } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindManyOrganization } from "@/application/usecase/Organization/FindManyOrganization";
import { FindManyOrganizationController } from "@/presentation/api/controllers/organizations/FindManyOrganizationController";

function makeRepo(
	overrides: Partial<IOrganizationRepository> = {},
): IOrganizationRepository {
	return {
		create: async () => {},
		findByExternalId: async () => null,
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
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

describe("FindManyOrganizationController — unit", () => {
	it("responds 200 with empty list", async () => {
		const ctrl = new FindManyOrganizationController(
			new FindManyOrganization(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and empty data", async () => {
		const ctrl = new FindManyOrganizationController(
			new FindManyOrganization(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: unknown[] };
		assert.equal(body.error, false);
		assert.deepEqual(body.data, []);
	});

	it("response body has pagination shape", async () => {
		const ctrl = new FindManyOrganizationController(
			new FindManyOrganization(makeRepo()),
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

	it("forwards search param to use case", async () => {
		let capturedSearch: string | undefined;
		const repo = makeRepo({
			findMany: async (_page, _limit, search) => {
				capturedSearch = search;
				return { items: [], totalItems: 0 };
			},
		});
		const ctrl = new FindManyOrganizationController(
			new FindManyOrganization(repo),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "acme" }),
			res as unknown as Response,
		);
		assert.equal(capturedSearch, "acme");
	});
});
