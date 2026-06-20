import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository } from "@ledger/shared";
import { Customers } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateCustomer } from "@/application/usecase/Customer/UpdateCustomer";
import { UpdateCustomerController } from "@/presentation/api/controllers/customers/UpdateCustomerController";

function makeCustomer(): Customers {
	return Customers.restore({
		id: "cus_001",
		merchantId: "merch_001",
		name: "Jane Doe",
		documentNumber: "12345678901",
		email: "jane@x.com",
		status: "active",
	});
}

function makeRepo(
	customer: Customers | null = makeCustomer(),
	overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => customer,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
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

describe("UpdateCustomerController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateCustomerController(new UpdateCustomer(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ customerId: "cus_001", name: "Updated" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and customerId in data", async () => {
		const ctrl = new UpdateCustomerController(new UpdateCustomer(makeRepo()));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ customerId: "cus_001", name: "Updated" }),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { customerId: string } };
		assert.equal(body.error, false);
		assert.equal(body.data.customerId, "cus_001");
	});

	it("forwards all body fields to use case", async () => {
		let saved: any;
		const repo = makeRepo(makeCustomer(), {
			update: async (c) => {
				saved = c;
			},
		});
		const ctrl = new UpdateCustomerController(new UpdateCustomer(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({ customerId: "cus_001", name: "New Name", status: "inactive" }),
			res as unknown as Response,
		);
		assert.equal(saved.get("name"), "New Name");
		assert.equal(saved.get("status"), "inactive");
	});
});
