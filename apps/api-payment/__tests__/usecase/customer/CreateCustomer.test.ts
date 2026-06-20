import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ICustomerRepository, IMerchantRepository } from "@ledger/shared";
import { MerchantNotFound, Merchants } from "@ledger/shared";
import { CreateCustomer } from "@/application/usecase/Customer/CreateCustomer";

function makeMerchant(): Merchants {
	return Merchants.restore({
		id: "merch_001",
		organizationId: "00000000-0000-0000-0000-000000000001",
		legalName: "Acme",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeMerchantRepo(
	merchant: Merchants | null = makeMerchant(),
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeCustomerRepo(
	overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

const validInput = {
	merchantId: "merch_001",
	name: "john doe",
	documentNumber: "12345678901",
	email: "john@example.com",
};

describe("CreateCustomer — use case", () => {
	it("returns customerId with 'cus_' prefix", async () => {
		const uc = new CreateCustomer(makeMerchantRepo(), makeCustomerRepo());
		const result = await uc.execute(validInput);
		assert.match(result.customerId, /^cus_/);
	});

	it("throws MerchantNotFound when merchant does not exist", async () => {
		const uc = new CreateCustomer(makeMerchantRepo(null), makeCustomerRepo());
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof MerchantNotFound,
		);
	});

	it("calls customerRepository.create with active status", async () => {
		let captured: any;
		const uc = new CreateCustomer(
			makeMerchantRepo(),
			makeCustomerRepo({
				create: async (c) => {
					captured = c;
				},
			}),
		);
		await uc.execute(validInput);
		assert.equal(captured.get("status"), "active");
		assert.equal(captured.get("merchantId"), "merch_001");
		assert.equal(captured.get("name"), "john doe");
	});

	it("stores email when provided", async () => {
		let captured: any;
		const uc = new CreateCustomer(
			makeMerchantRepo(),
			makeCustomerRepo({
				create: async (c) => {
					captured = c;
				},
			}),
		);
		await uc.execute({ ...validInput, email: "test@test.com" });
		assert.equal(captured.get("email"), "test@test.com");
	});

	it("stores undefined email when not provided", async () => {
		let captured: any;
		const uc = new CreateCustomer(
			makeMerchantRepo(),
			makeCustomerRepo({
				create: async (c) => {
					captured = c;
				},
			}),
		);
		const { email: _e, ...noEmail } = validInput;
		await uc.execute(noEmail);
		assert.equal(captured.get("email"), undefined);
	});
});
