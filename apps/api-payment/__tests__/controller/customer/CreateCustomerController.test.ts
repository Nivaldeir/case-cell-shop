import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository, IMerchantRepository } from "@ledger/shared";
import { Merchants } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateCustomer } from "@/application/usecase/Customer/CreateCustomer";
import { CreateCustomerController } from "@/presentation/api/controllers/customers/CreateCustomerController";

function makeMerchantRepo(): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () =>
			Merchants.restore({
				id: "merch_001",
				organizationId: "org_001",
				legalName: "X",
				legalDocument: "12345678000100",
				status: "active",
			}),
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeCustomerRepo(): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
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

describe("CreateCustomerController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateCustomerController(
			new CreateCustomer(makeMerchantRepo(), makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				merchantId: "merch_001",
				name: "john doe",
				documentNumber: "12345678901",
				email: "j@x.com",
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and customerId", async () => {
		const ctrl = new CreateCustomerController(
			new CreateCustomer(makeMerchantRepo(), makeCustomerRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				merchantId: "merch_001",
				name: "john doe",
				documentNumber: "12345678901",
				email: "j@x.com",
			}),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { customerId: string } };
		assert.equal(body.error, false);
		assert.match(body.data.customerId, /^cus_/);
	});
});
