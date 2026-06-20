import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IPixKeyRepository,
	IProviderRepository,
	Providers,
} from "@ledger/shared";
import type { Request, Response } from "express";
import { FindManyAccount } from "@/application/usecase/Account/FindManyAccount";
import { FindManyAccountController } from "@/presentation/api/controllers/accounts/FindManyAccountController";

function makeAccountRepo(
	overrides: Partial<IAccountRepository> = {},
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
		...overrides,
	};
}

function makePixKeyRepo(): IPixKeyRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => [],
		findByAccountIds: async () => [],
		findByMerchantId: async () => [],
		findByWalletScope: async () => [],
		findById: async () => null,
		findByKey: async () => null,
	};
}

function makeProviderRepo(): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByIds: async () => [],
		findByCode: async () => ({}) as unknown as Providers,
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeUseCase(accountRepo = makeAccountRepo()) {
	return new FindManyAccount(accountRepo, makePixKeyRepo(), makeProviderRepo());
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

describe("FindManyAccountController — unit", () => {
	it("responds 200 with empty list", async () => {
		const ctrl = new FindManyAccountController(makeUseCase());
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and empty data array", async () => {
		const ctrl = new FindManyAccountController(makeUseCase());
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
		const ctrl = new FindManyAccountController(makeUseCase());
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
		const accountRepo = makeAccountRepo({
			findMany: async (_page, _limit, search) => {
				capturedSearch = search;
				return { items: [], totalItems: 0 };
			},
		});
		const ctrl = new FindManyAccountController(makeUseCase(accountRepo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ page: 1, limit: 10, search: "john" }),
			res as unknown as Response,
		);
		assert.equal(capturedSearch, "john");
	});
});
