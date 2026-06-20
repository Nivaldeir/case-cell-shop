/**
 * FindManyProviderController — unit tests.
 *
 * Instantiates the controller with a mocked FindManyProvider use case
 * and calls `handle()` directly to verify the HTTP response shape.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import { Providers } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindManyProvider } from "@/application/usecase/Provider/FindManyProvider";
import { FindManyProviderController } from "@/presentation/api/controllers/providers/FindManyProviderController";

// ── Mock helpers ──────────────────────────────────────────────────────────────
function makeProvider(id: string): Providers {
	return Providers.restore({
		id,
		code: `CODE_${id}`,
		name: `Provider ${id}`,
		slug: `provider-${id}`,
		pixIn: true,
		pixOut: false,
		dict: false,
		refund: false,
		status: "active",
		description: "desc",
	});
}

function makeMockRepo(
	items: Providers[],
	totalItems: number,
	totalActive = items.filter((i) => i.get("status") === "active").length,
	totalInactive = items.filter((i) => i.get("status") === "deactivated").length,
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByIds: async () => [],
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({ items, totalItems, totalActive, totalInactive }),
		update: async () => {},
	};
}

function makeController(items: Providers[], totalItems: number) {
	const repo = makeMockRepo(items, totalItems);
	const useCase = new FindManyProvider(repo);
	return new FindManyProviderController(useCase);
}

/**
 * Minimal express-like request/response mocks.
 * The controller's `handle()` is called directly, bypassing the @Get decorator.
 */
function makeReq(query: Record<string, unknown> = {}): Request {
	return { query } as unknown as Request;
}

type MockResponse = {
	statusCode: number;
	body: unknown;
	status: (code: number) => MockResponse;
	json: (data: unknown) => MockResponse;
};

function makeRes(): MockResponse {
	const res: MockResponse = {
		statusCode: 200,
		body: undefined,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(data) {
			this.body = data;
			return this;
		},
	};
	return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("FindManyProviderController — unit", () => {
	it("responds with 200 and maps provider items to JSON", async () => {
		const providers = [makeProvider("prov_1"), makeProvider("prov_2")];
		const controller = makeController(providers, 2);
		const req = makeReq({ page: 1, limit: 10 });
		const res = makeRes();

		await controller.handle(req, res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			data: unknown[];
			pagination: unknown;
		};
		assert.equal(body.error, false);
		assert.equal((body.data as unknown[]).length, 2);
	});

	it("returns error:false in the response body", async () => {
		const controller = makeController([], 0);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 10 }),
			res as unknown as Response,
		);

		const body = res.body as { error: boolean };
		assert.equal(body.error, false);
	});

	it("returns empty data array when no providers found", async () => {
		const controller = makeController([], 0);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 10 }),
			res as unknown as Response,
		);

		const body = res.body as { data: unknown[] };
		assert.equal(body.data.length, 0);
	});

	it("includes pagination object in the response", async () => {
		const providers = Array.from({ length: 5 }, (_, i) =>
			makeProvider(`prov_${i}`),
		);
		const controller = makeController(providers, 15);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 5 }),
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
		assert.equal(body.pagination.page, 1);
		assert.equal(body.pagination.limit, 5);
		assert.equal(body.pagination.totalItems, 15);
		assert.equal(body.pagination.totalPages, 3);
		assert.equal(body.pagination.hasNextPage, true);
		assert.equal(body.pagination.hasPreviousPage, false);
	});

	it("includes summary with active/inactive/total counts", async () => {
		const items = [makeProvider("prov_1"), makeProvider("prov_2")];
		const repo: IProviderRepository = {
			create: async () => {},
			findById: async () => null,
			findByIds: async () => [],
			findIdByCode: async () => null,
			findIdBySlug: async () => null,
			findIdByCodeExcluding: async () => null,
			findIdBySlugExcluding: async () => null,
			findMany: async () => ({
				items,
				totalItems: 10,
				totalActive: 7,
				totalInactive: 3,
			}),
			update: async () => {},
		};
		const controller = new FindManyProviderController(
			new FindManyProvider(repo),
		);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 5 }),
			res as unknown as Response,
		);

		const body = res.body as {
			summary: {
				totalItems: number;
				totalActive: number;
				totalInactive: number;
			};
		};
		assert.equal(body.summary.totalItems, 10);
		assert.equal(body.summary.totalActive, 7);
		assert.equal(body.summary.totalInactive, 3);
	});

	it("passes search query to the use case", async () => {
		let capturedSearch: string | undefined;
		const repo = makeMockRepo([], 0);
		const useCase = new FindManyProvider({
			...repo,
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
		const controller = new FindManyProviderController(useCase);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 10, search: "acme" }),
			res as unknown as Response,
		);

		assert.equal(capturedSearch, "acme");
	});

	it("each item in data is the provider's JSON representation", async () => {
		const provider = makeProvider("prov_abc");
		const controller = makeController([provider], 1);
		const res = makeRes();

		await controller.handle(
			makeReq({ page: 1, limit: 10 }),
			res as unknown as Response,
		);

		const body = res.body as { data: Array<{ id: string; code: string }> };
		assert.equal(body.data[0]?.id, "prov_abc");
		assert.equal(body.data[0]?.code, "CODE_prov_abc");
	});
});
