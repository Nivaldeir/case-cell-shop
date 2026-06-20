import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import { Providers } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateProvider } from "@/application/usecase/Provider/UpdateProvider";
import { UpdateProviderController } from "@/presentation/api/controllers/providers/UpdateProviderController";

function makeProvider(): Providers {
	return Providers.restore({
		id: "prov_001",
		code: "OLD",
		name: "Old",
		slug: "old",
		pixIn: false,
		pixOut: false,
		dict: false,
		refund: false,
		status: "active",
		description: "old desc",
	});
}

function makeRepo(
	provider: Providers | null = makeProvider(),
	overrides: Partial<IProviderRepository> = {},
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => provider,
		findByIds: async () => [],
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeReq(body: Record<string, unknown>): Request {
	return { body, params: {}, query: {} } as unknown as Request;
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

describe("UpdateProviderController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateProviderController(new UpdateProvider(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ providerId: "prov_001", name: "New" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and providerId in data", async () => {
		const ctrl = new UpdateProviderController(new UpdateProvider(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ providerId: "prov_001", name: "New" }),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { providerId: string } };
		assert.equal(body.error, false);
		assert.equal(body.data.providerId, "prov_001");
	});

	it("forwards all body fields to use case", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		const ctrl = new UpdateProviderController(new UpdateProvider(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ providerId: "prov_001", name: "Updated Name", pixIn: true }),
			res as unknown as Response,
		);
		assert.equal(saved.get("name"), "Updated Name");
		assert.equal(saved.get("pixIn"), true);
	});
});
