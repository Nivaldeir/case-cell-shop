import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository } from "@ledger/shared";
import { CustomerNotFound, Customers } from "@ledger/shared";
import { UpdateCustomer } from "@/application/usecase/Customer/UpdateCustomer";

function makeCustomer(): Customers {
	return Customers.restore({
		id: "cus_001",
		merchantId: "merch_001",
		externalId: "ext-001",
		name: "john doe",
		documentNumber: "12345678901",
		email: "john@example.com",
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

describe("UpdateCustomer — use case", () => {
	it("returns customerId of the updated customer", async () => {
		const uc = new UpdateCustomer(makeRepo());
		const result = await uc.execute({ customerId: "cus_001", name: "Jane" });
		assert.equal(result.customerId, "cus_001");
	});

	it("throws CustomerNotFound when customer does not exist", async () => {
		const uc = new UpdateCustomer(makeRepo(null));
		await assert.rejects(
			() => uc.execute({ customerId: "cus_ghost" }),
			(e) => e instanceof CustomerNotFound,
		);
	});

	it("updates name when provided", async () => {
		let saved: any;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute({ customerId: "cus_001", name: "Jane Doe" });
		assert.equal(saved.get("name"), "Jane Doe");
	});

	it("updates status when provided", async () => {
		let saved: any;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute({ customerId: "cus_001", status: "blocked" });
		assert.equal(saved.get("status"), "blocked");
	});

	it("updates email when provided", async () => {
		let saved: any;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute({ customerId: "cus_001", email: "new@example.com" });
		assert.equal(saved.get("email"), "new@example.com");
	});

	it("does not overwrite fields when undefined is passed", async () => {
		let saved: any;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute({ customerId: "cus_001", name: undefined });
		assert.equal(saved.get("name"), "john doe"); // unchanged
	});

	it("updates multiple fields in a single call", async () => {
		let saved: any;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute({
			customerId: "cus_001",
			name: "Jane",
			status: "inactive",
		});
		assert.equal(saved.get("name"), "Jane");
		assert.equal(saved.get("status"), "inactive");
	});

	it("calls repository.update exactly once", async () => {
		let callCount = 0;
		const uc = new UpdateCustomer(
			makeRepo(makeCustomer(), {
				update: async () => {
					callCount++;
				},
			}),
		);
		await uc.execute({ customerId: "cus_001", name: "Jane" });
		assert.equal(callCount, 1);
	});
});
