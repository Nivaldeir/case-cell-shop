import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateProvider } from "@/application/usecase/Provider/CreateProvider";
import { CreateProviderController } from "@/presentation/api/controllers/providers/CreateProviderController";

function makeRepo(
	overrides: Partial<IProviderRepository> = {},
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => null,
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

function makeReq(body: Record<string, unknown> = {}): Request {
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

describe("CreateProviderController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateProviderController(new CreateProvider(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				code: "BANK",
				name: "Bank",
				slug: "bank",
				description: "desc",
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and data with providerId", async () => {
		const ctrl = new CreateProviderController(new CreateProvider(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				code: "BANK2",
				name: "Bank2",
				slug: "bank2",
				description: "desc",
			}),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { providerId: string } };
		assert.equal(body.error, false);
		assert.match(body.data.providerId, /^prov_/);
	});

	it("forwards the body to the use case", async () => {
		let captured: any;
		const repo = makeRepo({
			create: async (p) => {
				captured = p;
			},
		});
		const ctrl = new CreateProviderController(new CreateProvider(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				code: "FORWARD",
				name: "Forward",
				slug: "forward",
				description: "d",
				pixIn: true,
			}),
			res as unknown as Response,
		);
		assert.equal(captured.get("code"), "FORWARD");
		assert.equal(captured.get("pixIn"), true);
	});
});
