import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IMerchantRepository } from "@ledger/shared";
import { Merchants } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateMerchant } from "@/application/usecase/Merchant/UpdateMerchant";
import { UpdateMerchantController } from "@/presentation/api/controllers/merchants/UpdateMerchantController";

function makeMerchant(): Merchants {
	return Merchants.restore({
		id: "mer_001",
		organizationId: "org_001",
		legalName: "Old Corp",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeRepo(
	merchant: Merchants | null = makeMerchant(),
	overrides: Partial<IMerchantRepository> = {},
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
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

describe("UpdateMerchantController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateMerchantController(new UpdateMerchant(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "mer_001", legalName: "New Corp" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and merchantId in data", async () => {
		const ctrl = new UpdateMerchantController(new UpdateMerchant(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "mer_001", legalName: "New Corp" }),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { merchantId: string } };
		assert.equal(body.error, false);
		assert.equal(body.data.merchantId, "mer_001");
	});

	it("forwards all body fields to use case", async () => {
		let saved: any;
		const repo = makeRepo(makeMerchant(), {
			update: async (m) => {
				saved = m;
			},
		});
		const ctrl = new UpdateMerchantController(new UpdateMerchant(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				merchantId: "mer_001",
				legalName: "Updated Corp",
				status: "inactive",
			}),
			res as unknown as Response,
		);
		assert.equal(saved.get("legalName"), "Updated Corp");
		assert.equal(saved.get("status"), "inactive");
	});
});
