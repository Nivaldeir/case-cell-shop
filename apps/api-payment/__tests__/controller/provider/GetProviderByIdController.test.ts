import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import { Providers } from "@ledger/shared";
import type { Request, Response } from "express";
import { GetProviderById } from "@/application/usecase/Provider/GetProviderById";
import { GetProviderByIdController } from "@/presentation/api/controllers/providers/GetProviderByIdController";

function makeProvider(): Providers {
	return Providers.restore({
		id: "prov_001",
		code: "BANK",
		name: "Bank A",
		slug: "bank-a",
		pixIn: true,
		pixOut: false,
		dict: false,
		refund: false,
		status: "active",
		description: "desc",
	});
}

function makeRepo(
	provider: Providers | null = makeProvider(),
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
	};
}

function makeReq(providerId: string): Request {
	return { params: { providerId }, body: {}, query: {} } as unknown as Request;
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

describe("GetProviderByIdController — unit", () => {
	it("responds 200 with provider data", async () => {
		const ctrl = new GetProviderByIdController(new GetProviderById(makeRepo()));
		const res = makeRes();
		await ctrl.handle(makeReq("prov_001"), res as unknown as Response);
		assert.equal(res.statusCode, 200);
		const body = res.body as { success: boolean; data: { id: string } };
		assert.equal(body.success, true);
		assert.equal(body.data.id, "prov_001");
	});

	it("response body has error:null and success:true", async () => {
		const ctrl = new GetProviderByIdController(new GetProviderById(makeRepo()));
		const res = makeRes();
		await ctrl.handle(makeReq("prov_001"), res as unknown as Response);
		const body = res.body as { error: unknown; success: boolean };
		assert.equal(body.error, null);
		assert.equal(body.success, true);
	});

	it("forwards providerId to use case", async () => {
		let capturedId: string | undefined;
		const repo: IProviderRepository = {
			...makeRepo(),
			findById: async (id) => {
				capturedId = id;
				return makeProvider();
			},
		};
		const ctrl = new GetProviderByIdController(new GetProviderById(repo));
		const res = makeRes();
		await ctrl.handle(makeReq("prov_target"), res as unknown as Response);
		assert.equal(capturedId, "prov_target");
	});
});
